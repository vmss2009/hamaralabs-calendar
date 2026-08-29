import { NextResponse } from "next/server"
import type { NextAuthRequest } from "next-auth"
import { auth } from "@/lib/auth/edge-auth"

// Origins allowed to make cross-site, credentialed requests to /api/*.
// Comma-separated list, e.g. "https://calendar.hamaralabs.com,https://partner.example.com"
const ALLOWED_ORIGINS = (process.env.NEXT_PUBLIC_ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)

const CORS_METHODS = "GET,DELETE,PATCH,POST,PUT,OPTIONS"
const CORS_HEADERS =
  "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Api-Key"

function applyCors(res: NextResponse, origin: string) {
  res.headers.set("Access-Control-Allow-Origin", origin)
  res.headers.set("Access-Control-Allow-Credentials", "true")
  res.headers.set("Access-Control-Allow-Methods", CORS_METHODS)
  res.headers.set("Access-Control-Allow-Headers", CORS_HEADERS)
  // Response varies by request origin, so it must not be cached across origins.
  res.headers.set("Vary", "Origin")
  return res
}

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith("/api/")) return NextResponse.next()

  const origin = req.headers.get("origin")

  // No Origin header means this isn't a cross-site browser request (e.g. a
  // same-origin page load, or a server-to-server caller like the slots API
  // integration) — nothing to check here, let route-level auth decide.
  if (!origin) return NextResponse.next()

  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin)

  // A browser can't be tricked into lying about the Origin header, so a
  // mismatch here means a cross-site request from a site we didn't
  // allowlist — reject outright rather than just withholding CORS headers,
  // otherwise a disallowed site could still trigger side effects (CSRF)
  // even though it couldn't read the response back.
  if (!isAllowedOrigin) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
  }

  // Preflight requests never reach the route handler, so they must be
  // answered here.
  if (req.method === "OPTIONS") {
    return applyCors(new NextResponse(null, { status: 204 }), origin)
  }

  return applyCors(NextResponse.next(), origin)
})
