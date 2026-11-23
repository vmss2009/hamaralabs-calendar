import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { isValidApiKey } from "@/lib/auth/api-key";

// List slots for a given email, including their bookings.
// Server-to-server only (external service), authenticated via X-Api-Key.
export async function GET(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  try {
    const slots = await prisma.slot.findMany({
      where: { email },
      include: { bookings: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: slots });
  } catch {
    return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });
  }
}
