import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

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
    
    const metadata = user?.metadata as Record<string, unknown> | null;
    const isPublic = (metadata && typeof metadata.isPublic === 'boolean') ? metadata.isPublic : true;
    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      isPublic,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 