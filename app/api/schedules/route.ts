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
    const userId = searchParams.get("userId");
    
    if (!date || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }
    
    // Ensure the user can only access their own schedules
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        date: new Date(date),
      },
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
    const { date, timeSlots, userId } = body;
    
    if (!date || !timeSlots || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Ensure the user can only update their own schedules
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if a schedule already exists for this date
    const existingSchedule = await prisma.schedule.findUnique({
      where: {
        userId_date: {
          userId,
          date: new Date(date),
        },
      },
    });
    
    let schedule;
    
    if (existingSchedule) {
      // Update existing schedule
      schedule = await prisma.schedule.update({
        where: {
          id: existingSchedule.id,
        },
        data: {
          timeSlots,
        },
      });
    } else {
      // Create new schedule
      schedule = await prisma.schedule.create({
        data: {
          userId,
          date: new Date(date),
          timeSlots,
        },
      });
    }
    
    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Error saving schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 