import { auth } from "@/lib/auth/auth";

const allowedOrigins = (process.env.NEXT_PUBLIC_ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

export default auth(async (req, res) => {
    if (req.nextUrl.pathname.startsWith("/api")) {
        const origin = req.nextUrl.origin || "";
        
        if (!allowedOrigins.includes(origin)) {
            return new Response("Origin not allowed", { status: 403 });
        }
    }

    return;
});