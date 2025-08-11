import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

// IST helpers
const IST_OFFSET_MIN = 330; // +05:30 in minutes
function startOfDayIST(date: Date): Date {
  // Convert given UTC timestamp to IST by adding offset, take its UTC Y/M/D, then subtract offset to get UTC timestamp of that IST midnight.
  const ist = new Date(date.getTime() + IST_OFFSET_MIN * 60000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - IST_OFFSET_MIN * 60000);
}

export async function GET(
  request: NextRequest,
  { params }: any
) {
  try {
    const { username } = params;
    const url = new URL(request.url);
    const leadMinutesParam = url.searchParams.get("leadMinutes");
    // Default 30 minute lead if not provided
    const leadMinutes = leadMinutesParam ? Math.max(0, parseInt(leadMinutesParam, 10) || 0) : 30;
    const now = new Date(); // current UTC timestamp
    const todayStart = startOfDayIST(now); // IST day boundary in UTC timeline

    // Find the user by username
    const user = await (prisma.user as any).findUnique({ where: { username } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isPublic = user?.metadata?.isPublic !== undefined ? user.metadata.isPublic : true;
    if (isPublic === false) {
      return NextResponse.json({ error: "Schedule is private" }, { status: 403 });
    }

    // Get all schedules for this user
    let schedules = await prisma.schedule.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });

    // Apply leadMinutes filtering only to today's schedule (do not mutate DB, only response)
    {
      const threshold = new Date(now.getTime() + leadMinutes * 60 * 1000);
      schedules = schedules.map(sched => {
        const schedDate = new Date(sched.date);
        const schedDayStart = startOfDayIST(schedDate);
        if (schedDayStart.getTime() !== todayStart.getTime()) return sched; // not today (IST)
        const newTimeSlots = sched.timeSlots.filter(slot => {
          const startStr = slot.split("-")[0];
          const [h, m] = startStr.split(":").map(Number);
          const slotStart = new Date(schedDayStart.getTime() + (h * 60 + m) * 60000);
          return slotStart.getTime() >= threshold.getTime();
        });
        return { ...sched, timeSlots: newTimeSlots };
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