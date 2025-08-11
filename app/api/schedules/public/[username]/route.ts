import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { startOfDay, format } from "date-fns";

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
    const now = new Date();
    const todayStart = startOfDay(now);
    
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
      const todayKey = format(now, "yyyy-MM-dd");
      schedules = schedules.map(sched => {
        const schedKey = format(new Date(sched.date), "yyyy-MM-dd");
        if (schedKey !== todayKey) return sched;
        const schedDayStart = startOfDay(new Date(sched.date));
        const newTimeSlots = sched.timeSlots.filter(slot => {
          const startStr = slot.split("-")[0]; // HH:mm
          const [h, m] = startStr.split(":").map(Number);
          const slotStart = new Date(schedDayStart);
          slotStart.setHours(h, m, 0, 0);
          // Always drop slots already in the past, and those inside lead window
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