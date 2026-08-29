import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import prisma from "@/lib/db/prisma";

// Type definitions
interface TimeSlotInput {
  startTime: string;
  endTime: string;
  maxSlots: number;
}

interface ScheduleRequestBody {
  date: string;
  timeSlots: TimeSlotInput[];
  userId: string;
  replicateDates?: string[];
}

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
    
    const whereClause: { userId: string; date?: Date | { gte: Date; lte: Date } } = {
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
    
    const body: ScheduleRequestBody = await request.json();
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
    
    const schedules: Array<{ id: string; date: Date; timeSlots: Array<{ id: string; startTime: string; endTime: string; maxSlots: number; bookedSlots: number }> }> = [];
    
    // Use a single transaction to handle all operations efficiently
    await prisma.$transaction(async (tx) => {
      // Fetch all existing schedules and bookings in batch
      const existingSchedules = await tx.schedule.findMany({
        where: {
          userId,
          date: {
            in: datesToUpdate.map(d => new Date(d))
          }
        },
        include: {
          timeSlots: true
        }
      });
      
      const existingBookings = await tx.booking.findMany({
        where: {
          userId,
          date: {
            in: datesToUpdate.map(d => new Date(d))
          },
          status: { not: 'CANCELED' }
        }
      });
      
      // Process each date
      for (const currentDate of datesToUpdate) {
        const currentDateObj = new Date(currentDate);
        const existingSchedule = existingSchedules.find(s => 
          s.date.getTime() === currentDateObj.getTime()
        );
        const dateBookings = existingBookings.filter(b => 
          b.date.getTime() === currentDateObj.getTime()
        );
        
        let schedule;
        
        if (existingSchedule) {
          // Delete existing time slots
          await tx.timeSlot.deleteMany({
            where: {
              scheduleId: existingSchedule.id
            }
          });
          
          // Create new time slots
          await tx.timeSlot.createMany({
            data: timeSlots.map((slot: TimeSlotInput) => ({
              scheduleId: existingSchedule.id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              maxSlots: slot.maxSlots,
              bookedSlots: 0
            }))
          });
          
          // Get the newly created time slots
          const newTimeSlots = await tx.timeSlot.findMany({
            where: { scheduleId: existingSchedule.id },
            orderBy: { startTime: 'asc' }
          });
          
          // Process bookings and update slot counts in batches
          const timeSlotUpdates = new Map();
          const bookingsToCancel = [];
          
          for (const booking of dateBookings) {
            const matchingTimeSlot = newTimeSlots.find(ts => 
              ts.startTime === booking.startTime && ts.endTime === booking.endTime
            );
            
            if (matchingTimeSlot) {
              const currentCount = timeSlotUpdates.get(matchingTimeSlot.id) || 0;
              timeSlotUpdates.set(matchingTimeSlot.id, currentCount + 1);
            } else {
              bookingsToCancel.push(booking.id);
            }
          }
          
          // Batch update time slot booked counts
          const timeSlotUpdatePromises = Array.from(timeSlotUpdates.entries()).map(([slotId, count]) =>
            tx.timeSlot.update({
              where: { id: slotId },
              data: { bookedSlots: count }
            })
          );
          
          await Promise.all(timeSlotUpdatePromises);
          
          // Batch cancel bookings that no longer fit
          if (bookingsToCancel.length > 0) {
            await tx.booking.updateMany({
              where: { id: { in: bookingsToCancel } },
              data: { status: 'CANCELED' }
            });
          }
          
          schedule = await tx.schedule.findUnique({
            where: { id: existingSchedule.id },
            include: { timeSlots: { orderBy: { startTime: 'asc' } } }
          });
        } else {
          // Create new schedule with time slots
          schedule = await tx.schedule.create({
            data: {
              userId,
              date: currentDateObj,
              timeSlots: {
                create: timeSlots.map((slot: TimeSlotInput) => ({
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
        
        if (schedule) {
          schedules.push(schedule);
        }
      }
    });
    
    return NextResponse.json({ 
      schedules, 
      message: `Updated ${schedules.length} schedule(s)` 
    });
  } catch (error) {
    console.error("Error saving schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
