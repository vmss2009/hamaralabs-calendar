import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";

export default async function Home() {
  const session = await auth();
  
  if (session?.user) {
    redirect("/dashboard");
  } else {
    redirect("/auth/signin");
  }
  
}
