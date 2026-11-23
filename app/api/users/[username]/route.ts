import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { isUserPublic } from "@/lib/user-visibility";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    
    // Fetch user including metadata
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // This endpoint is unauthenticated, so only return what the public
    // booking page needs — never the user's email or internal id.
    return NextResponse.json({
      username: user.username,
      name: user.name,
      isPublic: isUserPublic(user.metadata),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 