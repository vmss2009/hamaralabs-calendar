import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { startOfDay } from "date-fns";

export async function DELETE(_req: NextRequest, { params }: { params: any }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, userId: true, date: true, timeSlot: true },
    });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find matching schedule (userId + date unique)
    const schedule = await prisma.schedule.findFirst({
      where: { userId: booking.userId, date: booking.date },
      select: { id: true, timeSlots: true },
    });

    // If no schedule, optionally recreate one with this single timeSlot (rare)
    const ops: any[] = [];

    if (schedule) {
      const ts = new Set(schedule.timeSlots);
      ts.add(booking.timeSlot);
      // Sort time slots lexicographically (HH:MM-HH:MM) for consistency
      const sorted = Array.from(ts).sort();
      ops.push(prisma.schedule.update({ where: { id: schedule.id }, data: { timeSlots: { set: sorted } } }));
    } else {
      ops.push(prisma.schedule.create({
        data: {
          userId: booking.userId,
          date: startOfDay(booking.date),
          timeSlots: [booking.timeSlot],
        },
      }));
    }

    ops.push(prisma.booking.delete({ where: { id: booking.id } }));

    await prisma.$transaction(ops);

    return NextResponse.json({ success: true, restoredSlot: booking.timeSlot });
  } catch (e) {
    console.error("Delete booking failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}