import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { Prisma } from "@prisma/client";

interface SlotItem {
  price: number;
  total: number;
  quantity: number;
  description: string;
  completed: boolean;
  [key: string]: unknown;
}

// Toggle the `completed` flag on one line item of the booking's linked Slot.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const itemIndex = Number(body?.itemIndex);
    const completed = body?.completed;

    if (!Number.isInteger(itemIndex) || itemIndex < 0 || typeof completed !== "boolean") {
      return NextResponse.json({ error: "itemIndex (integer) and completed (boolean) are required" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { userId: true, slotId: true },
    });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!booking.slotId) {
      return NextResponse.json({ error: "Booking has no associated slot" }, { status: 400 });
    }

    const slot = await prisma.slot.findUnique({ where: { id: booking.slotId }, select: { items: true } });
    if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });

    const items = Array.isArray(slot.items) ? (slot.items as unknown as SlotItem[]) : [];
    if (itemIndex >= items.length) {
      return NextResponse.json({ error: "itemIndex out of range" }, { status: 400 });
    }

    const updatedItems = items.map((item, i) => (i === itemIndex ? { ...item, completed } : item));

    await prisma.slot.update({
      where: { id: booking.slotId },
      data: { items: updatedItems as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ items: updatedItems });
  } catch (error: unknown) {
    console.error("Update booking item failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

    const deleteBooking = prisma.booking.delete({ where: { id: booking.id } });
    
    // Decrement the booked slots count if schedule and time slot exist
    if (schedule && schedule.timeSlots.length > 0) {
      const timeSlot = schedule.timeSlots[0];
      const updateTimeSlot = prisma.timeSlot.update({
        where: { id: timeSlot.id },
        data: {
          bookedSlots: {
            decrement: 1
          }
        }
      });
      await prisma.$transaction([deleteBooking, updateTimeSlot]);
    } else {
      await deleteBooking;
    }

    return NextResponse.json({ 
      success: true, 
      restoredSlot: `${booking.startTime}-${booking.endTime}` 
    });
  } catch (error: unknown) {
    console.error("Delete booking failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
