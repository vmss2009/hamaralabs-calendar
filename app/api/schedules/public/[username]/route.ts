import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: any
) {
  try {
    const { username } = params;
    
    // Find the user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Get all schedules for this user
    const schedules = await prisma.schedule.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });
    
    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 