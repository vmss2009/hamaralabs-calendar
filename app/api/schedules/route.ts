import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import prisma from "@/lib/db/prisma";

// GET /api/schedules - Get schedules for a specific date and user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }
    
    // Ensure the user can only access their own schedules
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    let whereClause: any = {
      userId,
    };
    
    if (date) {
      // Single date query (existing behavior)
      whereClause.date = new Date(date);
    } else if (startDate && endDate) {
      // Date range query (new functionality)
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else {
      return NextResponse.json({ error: "Either date or startDate+endDate must be provided" }, { status: 400 });
    }
    
    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      include: {
        timeSlots: {
          orderBy: {
            startTime: 'asc'
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/schedules - Create or update a schedule
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const { date, timeSlots, userId, replicateDates } = body;
    
    if (!date || !timeSlots || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Ensure the user can only update their own schedules
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Validate time slot format
    for (const slot of timeSlots) {
      if (!slot.startTime || !slot.endTime || !slot.maxSlots || slot.maxSlots < 1) {
        return NextResponse.json({ error: "Invalid time slot format" }, { status: 400 });
      }
    }
    
    const datesToUpdate = replicateDates && Array.isArray(replicateDates) ? 
      [date, ...replicateDates] : [date];
    
    const schedules = [];
    
    // Process each date
    for (const currentDate of datesToUpdate) {
      // Check if a schedule already exists for this date
      const existingSchedule = await prisma.schedule.findUnique({
        where: {
          userId_date: {
            userId,
            date: new Date(currentDate),
          },
        },
        include: {
          timeSlots: true
        }
      });
      
      let schedule;
      
      if (existingSchedule) {
        // Delete existing time slots and create new ones
        await prisma.timeSlot.deleteMany({
          where: {
            scheduleId: existingSchedule.id
          }
        });
        
        // Create new time slots
        await prisma.timeSlot.createMany({
          data: timeSlots.map((slot: any) => ({
            scheduleId: existingSchedule.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxSlots: slot.maxSlots,
            bookedSlots: 0
          }))
        });
        
        schedule = await prisma.schedule.findUnique({
          where: { id: existingSchedule.id },
          include: { timeSlots: { orderBy: { startTime: 'asc' } } }
        });
      } else {
        // Create new schedule with time slots
        schedule = await prisma.schedule.create({
          data: {
            userId,
            date: new Date(currentDate),
            timeSlots: {
              create: timeSlots.map((slot: any) => ({
                startTime: slot.startTime,
                endTime: slot.endTime,
                maxSlots: slot.maxSlots,
                bookedSlots: 0
              }))
            }
          },
          include: {
            timeSlots: {
              orderBy: {
                startTime: 'asc'
              }
            }
          }
        });
      }
      
      schedules.push(schedule);
    }
    
    return NextResponse.json({ 
      schedules, 
      message: `Updated ${schedules.length} schedule(s)` 
    });
  } catch (error) {
    console.error("Error saving schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
