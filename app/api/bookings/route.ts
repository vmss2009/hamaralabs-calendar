// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { isBefore } from "date-fns";
import { isUserPublic } from "@/lib/user-visibility";
import { BOOKING_LEAD_MINUTES, slotStartInstant } from "@/lib/schedule-time";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// Per-IP limit on booking attempts (successful or not), per 10 minutes.
// Override with BOOKING_RATE_LIMIT if many guests share one IP (e.g. a school
// network behind NAT).
const bookingRateLimiter = createRateLimiter({
  limit: Math.max(1, parseInt(process.env.BOOKING_RATE_LIMIT || "10", 10) || 10),
  windowMs: 10 * 60 * 1000,
});

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_NOTES_LENGTH = 2000;
const MAX_TIME_LENGTH = 5; // "HH:MM"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper: build a UTC midnight from yyyy-MM-dd. Returns null for anything
// that isn't a real calendar date.
function utcMidnightFromYMD(ymd: unknown): Date | null {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, (m - 1), d, 0, 0, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
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
    if (!dayStartUtc) {
      return NextResponse.json({ message: "Invalid date" }, { status: 400 });
    }
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
    // Unauthenticated endpoint (and each booking can trigger a phone call), so
    // throttle per client IP before doing any work.
    const rate = bookingRateLimiter(getClientIp(req.headers));
    if (!rate.allowed) {
      return NextResponse.json(
        { message: "Too many booking attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }
    const { username, date, startTime, endTime, guestName, guestEmail, notes, slotId } = body;

    if (!username || !date || !startTime || !endTime || !guestName || !guestEmail) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    // This endpoint is public, so every field is attacker-controlled. Require
    // plain strings (an object here would be interpreted by Prisma as a query
    // operator, e.g. {"not": ""}) and cap lengths.
    if (
      !isNonEmptyString(username, MAX_NAME_LENGTH) ||
      !isNonEmptyString(startTime, MAX_TIME_LENGTH) ||
      !isNonEmptyString(endTime, MAX_TIME_LENGTH) ||
      !isNonEmptyString(guestName, MAX_NAME_LENGTH) ||
      !isNonEmptyString(guestEmail, MAX_EMAIL_LENGTH) ||
      (notes != null && (typeof notes !== "string" || notes.length > MAX_NOTES_LENGTH)) ||
      (slotId != null && typeof slotId !== "string")
    ) {
      return NextResponse.json({ message: "Invalid fields" }, { status: 400 });
    }
    if (!EMAIL_RE.test(guestEmail.trim())) {
      return NextResponse.json({ message: "Invalid email address" }, { status: 400 });
    }

    // Derive the day window in UTC to avoid TZ pitfalls
    // date comes as "yyyy-MM-dd" from the client
    const dayStartUtc = utcMidnightFromYMD(date);
    if (!dayStartUtc) {
      return NextResponse.json({ message: "Invalid date" }, { status: 400 });
    }

    // If provided, ensure the Slot exists
    if (slotId) {
      const slot = await prisma.slot.findUnique({ where: { id: slotId } });
      if (!slot) return NextResponse.json({ message: "Invalid slotId" }, { status: 400 });
    }

    // Resolve provider
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (!isUserPublic(user.metadata)) {
      return NextResponse.json({ message: "This schedule is private" }, { status: 403 });
    }

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

    // The day check above doesn't stop booking a slot earlier today that has
    // already started. Apply the same IST start time + lead window the public
    // listing uses. (Written as !(>=) so a malformed time also rejects.)
    const slotStart = slotStartInstant(schedule.date, timeSlot.startTime);
    const earliestBookable = Date.now() + BOOKING_LEAD_MINUTES * 60 * 1000;
    if (!(slotStart.getTime() >= earliestBookable)) {
      return NextResponse.json({ message: "Time slot is no longer available" }, { status: 409 });
    }
    
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

    // Transaction: atomically reserve a seat, then create the booking. The
    // checks above are only a fast path — two concurrent requests can both
    // pass them, so the conditional increment (only if bookedSlots is still
    // below maxSlots) is what actually prevents overbooking.
    try {
      const booking = await prisma.$transaction(async (tx) => {
        const reserved = await tx.timeSlot.updateMany({
          where: {
            id: timeSlot.id,
            bookedSlots: { lt: prisma.timeSlot.fields.maxSlots },
          },
          data: { bookedSlots: { increment: 1 } },
        });
        if (reserved.count === 0) return null;

        return tx.booking.create({
          data: {
            userId: user.id,
            date: schedule.date,
            startTime,
            endTime,
            guestName: guestName.trim(),
            guestEmail: guestEmail.trim(),
            notes: notes ?? null,
            status: "CONFIRMED",
            ...(slotId ? { slotId } : {}),
          },
        });
      });

      if (!booking) {
        return NextResponse.json({ message: "Time slot fully booked" }, { status: 409 });
      }

      // Optional external phone call trigger based on user metadata
      try {
        const callOnBook = (user.metadata as Record<string, unknown>)?.callOnBook === true;
        if (callOnBook) {
          // Bounded so a slow/hung webhook can't hold the booking request open.
          await fetch("https://us-central1-hamaralabs-prod.cloudfunctions.net/phoneCall/call", {
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
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
