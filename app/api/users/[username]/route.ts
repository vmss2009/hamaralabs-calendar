import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: any
) {
  try {
    const { username } = params;
    
    // Fetch user including metadata (cast to any until prisma client regenerated with metadata field)
    const user = await (prisma.user as any).findUnique({
      where: { username },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const isPublic = (user?.metadata && user.metadata.isPublic !== undefined) ? user.metadata.isPublic : true;
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