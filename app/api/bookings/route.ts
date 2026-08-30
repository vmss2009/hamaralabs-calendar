// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { isBefore } from "date-fns";

// Helper: build a UTC midnight from yyyy-MM-dd
function utcMidnightFromYMD(ymd: string) {
  // ymd assumed like "2025-08-11"
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, (m - 1), d, 0, 0, 0, 0));
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const date = searchParams.get("date"); // yyyy-MM-dd

    if (!userId || !date) {
      return NextResponse.json({ message: "Missing userId or date" }, { status: 400 });
    }

    // Bookings contain guest PII (name, email, notes) — only the owning
    // calendar user may list them.
    if (userId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const dayStartUtc = utcMidnightFromYMD(date);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        userId,
        status: { not: "CANCELED" },
        date: { gte: dayStartUtc, lt: dayEndUtc },
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        startTime: true,
        endTime: true,
        guestName: true,
        guestEmail: true,
        notes: true,
        status: true,
        completed: true,
        createdAt: true,
      },
    });

    return NextResponse.json(bookings);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { username, date, startTime, endTime, guestName, guestEmail, notes, slotId } = await req.json();

    if (!username || !date || !startTime || !endTime || !guestName || !guestEmail) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    // If provided, ensure the Slot exists
    if (slotId) {
      const slot = await prisma.slot.findUnique({ where: { id: String(slotId) } });
      if (!slot) return NextResponse.json({ message: "Invalid slotId" }, { status: 400 });
    }

    // Resolve provider
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // Derive the day window in UTC to avoid TZ pitfalls
    // date comes as "yyyy-MM-dd" from the client
    const dayStartUtc = utcMidnightFromYMD(date);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    // Disallow past days by comparing at UTC day granularity
    const todayUtcMidnight = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0, 0, 0, 0
    ));
    if (isBefore(dayStartUtc, todayUtcMidnight)) {
      return NextResponse.json({ message: "Cannot book past dates" }, { status: 400 });
    }

    // Find the schedule for that day
    const schedule = await prisma.schedule.findFirst({
      where: {
        userId: user.id,
        date: { gte: dayStartUtc, lt: dayEndUtc },
      },
      include: {
        timeSlots: {
          where: {
            startTime,
            endTime
          }
        }
      }
    });

    if (!schedule || schedule.timeSlots.length === 0) {
      return NextResponse.json({ message: "Time slot not available" }, { status: 409 });
    }

    const timeSlot = schedule.timeSlots[0];
    
    // Check if there are available slots
    if (timeSlot.bookedSlots >= timeSlot.maxSlots) {
      return NextResponse.json({ message: "Time slot fully booked" }, { status: 409 });
    }

    // Count existing confirmed bookings for this time slot
    const existingBookings = await prisma.booking.count({
      where: {
        userId: user.id,
        date: { gte: dayStartUtc, lt: dayEndUtc },
        startTime,
        endTime,
        status: { not: "CANCELED" }
      }
    });

    if (existingBookings >= timeSlot.maxSlots) {
      return NextResponse.json({ message: "Time slot fully booked" }, { status: 409 });
    }

    // Transaction: create booking and update booked slots count
    try {
      const [booking] = await prisma.$transaction([
        prisma.booking.create({
          data: {
            userId: user.id,
            date: schedule.date,
            startTime,
            endTime,
            guestName,
            guestEmail,
            notes,
            status: "CONFIRMED",
            ...(slotId ? { slotId: String(slotId) } : {}),
          },
        }),
        prisma.timeSlot.update({
          where: { id: timeSlot.id },
          data: {
            bookedSlots: {
              increment: 1
            }
          }
        })
      ]);
      
      // Optional external phone call trigger based on user metadata
      try {
        const callOnBook = (user.metadata as Record<string, unknown>)?.callOnBook === true;
        if (callOnBook) {
          await fetch("https://us-central1-hamaralabs-prod.cloudfunctions.net/phoneCall/call").catch(() => {});
        }
      } catch (extErr) {
        console.error("callOnBook external trigger failed", extErr);
        // Do not fail the booking because of an auxiliary action
      }

      return NextResponse.json({ booking }, { status: 201 });
    } catch (err: unknown) {
      console.error("Booking error:", err);
      return NextResponse.json({ message: "Failed to create booking" }, { status: 500 });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
