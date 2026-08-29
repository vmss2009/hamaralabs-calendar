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
  const isAllowedOrigin = !!origin && ALLOWED_ORIGINS.includes(origin)

  // Preflight requests never reach the route handler, so they must be
  // answered here.
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: isAllowedOrigin ? 204 : 403 })
    return isAllowedOrigin ? applyCors(res, origin) : res
  }

  const res = NextResponse.next()
  return isAllowedOrigin ? applyCors(res, origin) : res
})
