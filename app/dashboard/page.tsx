import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Calendar from "@/components/Calendar";
import Navigation from "@/components/Navigation";
import prisma from "@/lib/db/prisma";

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }
  
  // Get the user's username
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  
  if (!user) {
    redirect("/auth/signin");
  }
  
  return (
    <div>
      <Navigation username={user.username || ""} />
      <div className="container mx-auto py-8 px-4">
        <Calendar userId={session.user.id || ""} />
      </div>
    </div>
  );
} 