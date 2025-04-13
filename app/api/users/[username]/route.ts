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
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 