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
      select: { id: true, userId: true, date: true, startTime: true, endTime: true },
    });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find matching schedule and time slot
    const schedule = await prisma.schedule.findFirst({
      where: { userId: booking.userId, date: booking.date },
      include: {
        timeSlots: {
          where: {
            startTime: booking.startTime,
            endTime: booking.endTime
          }
        }
      }
    });

    const ops: any[] = [];
    
    // Delete the booking
    ops.push(prisma.booking.delete({ where: { id: booking.id } }));
    
    // Decrement the booked slots count if schedule and time slot exist
    if (schedule && schedule.timeSlots.length > 0) {
      const timeSlot = schedule.timeSlots[0];
      ops.push(prisma.timeSlot.update({
        where: { id: timeSlot.id },
        data: {
          bookedSlots: {
            decrement: 1
          }
        }
      }));
    }

    await prisma.$transaction(ops);

    return NextResponse.json({ 
      success: true, 
      restoredSlot: `${booking.startTime}-${booking.endTime}` 
    });
  } catch (e) {
    console.error("Delete booking failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
