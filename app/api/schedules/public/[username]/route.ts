import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { isUserPublic } from "@/lib/user-visibility";
import { BOOKING_LEAD_MINUTES, slotStartInstant, startOfDayIST } from "@/lib/schedule-time";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const url = new URL(request.url);
    const leadMinutesParam = url.searchParams.get("leadMinutes");
    // Callers may ask for a longer lead, but never a shorter one than the
    // booking API enforces (otherwise we'd list slots that can't be booked).
    const leadMinutes = Math.max(BOOKING_LEAD_MINUTES, leadMinutesParam ? parseInt(leadMinutesParam, 10) || 0 : 0);
    const now = new Date(); // current UTC timestamp
    const todayStart = startOfDayIST(now); // IST day boundary in UTC timeline

    // Find the user by username
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Enforce visibility server-side; the UI check alone can be bypassed by
    // calling this endpoint directly.
    if (!isUserPublic(user.metadata)) {
      return NextResponse.json({ error: "This schedule is private" }, { status: 403 });
    }

    // Get all schedules for this user, filter out past dates (IST)
    let schedules = await prisma.schedule.findMany({
      where: { userId: user.id },
      include: {
        timeSlots: {
          orderBy: {
            startTime: 'asc'
          }
        }
      },
      orderBy: { date: "asc" },
    });

    // Only keep schedules for today or future (IST)
    schedules = schedules.filter(sched => {
      const schedDate = new Date(sched.date);
      const schedDayStart = startOfDayIST(schedDate);
      return schedDayStart.getTime() >= todayStart.getTime();
    });

    // Apply leadMinutes filtering only to today's schedule (do not mutate DB, only response)
    {
      const threshold = new Date(now.getTime() + leadMinutes * 60 * 1000);
      schedules = schedules.map(sched => {
        const schedDate = new Date(sched.date);
        const schedDayStart = startOfDayIST(schedDate);
        if (schedDayStart.getTime() !== todayStart.getTime()) return sched; // not today (IST)
        
        // Filter time slots based on availability and time threshold
        const availableTimeSlots = sched.timeSlots.filter(slot => {
          const slotStart = slotStartInstant(schedDate, slot.startTime);
          // Only include if time hasn't passed and there are available slots
          return slotStart.getTime() >= threshold.getTime() && slot.bookedSlots < slot.maxSlots;
        });
        
        return { ...sched, timeSlots: availableTimeSlots };
      });
    }

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 