// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { isBefore, parseISO } from "date-fns";

// Helper: build a UTC midnight from yyyy-MM-dd
function utcMidnightFromYMD(ymd: string) {
  // ymd assumed like "2025-08-11"
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, (m - 1), d, 0, 0, 0, 0));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const date = searchParams.get("date"); // yyyy-MM-dd

    if (!userId || !date) {
      return NextResponse.json({ message: "Missing userId or date" }, { status: 400 });
    }

    const dayStartUtc = utcMidnightFromYMD(date);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        userId,
        status: { not: "CANCELED" },
        date: { gte: dayStartUtc, lt: dayEndUtc },
      },
      orderBy: [{ timeSlot: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        timeSlot: true,
        guestName: true,
        guestEmail: true,
        notes: true,
        status: true,
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
    const { username, date, timeSlot, guestName, guestEmail, notes } = await req.json();

    if (!username || !date || !timeSlot || !guestName || !guestEmail) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
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

    // Find the schedule for that *day* (not exact instant)
    const schedule = await prisma.schedule.findFirst({
      where: {
        userId: user.id,
        date: { gte: dayStartUtc, lt: dayEndUtc },
      },
      select: { id: true, date: true, timeSlots: true },
    });

    if (!schedule) {
      return NextResponse.json({ message: "Time slot not available" }, { status: 409 });
    }

    // Validate the slot still exists
    if (!schedule.timeSlots.includes(timeSlot)) {
      return NextResponse.json({ message: "Time slot not available" }, { status: 409 });
    }

    // Transaction: create booking; remove slot from schedule
    try {
      const [booking] = await prisma.$transaction([
        prisma.booking.create({
          data: {
            userId: user.id,
            date: schedule.date,      // store the exact schedule date we found
            timeSlot,
            guestName,
            guestEmail,
            notes,
            status: "CONFIRMED",
          },
        }),
        prisma.schedule.update({
          where: { id: schedule.id },
          data: {
            timeSlots: {
              set: schedule.timeSlots.filter((s) => s !== timeSlot),
            },
          },
        }),
      ]);
      // Optional external phone call trigger based on user metadata
      try {
        const callOnBook = (user as any)?.metadata?.callOnBook === true;
        if (callOnBook) {
          await fetch("https://us-central1-hamaralabs-prod.cloudfunctions.net/phoneCall/call").catch(() => {});
        }
      } catch (extErr) {
        console.error("callOnBook external trigger failed", extErr);
        // Do not fail the booking because of an auxiliary action
      }

      return NextResponse.json({ booking }, { status: 201 });
    } catch (err: any) {
      // Unique violation on Booking @@unique([userId, date, timeSlot]) still protects races
      if (err?.code === "P2002") {
        return NextResponse.json({ message: "Slot already booked" }, { status: 409 });
      }
      throw err;
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}