import { NextResponse } from "next/server"
import type { NextAuthRequest } from "next-auth"
import { auth } from "@/lib/auth/auth"

// Origins allowed to make cross-site, credentialed requests to /api/*.
// Comma-separated list, e.g. "https://calendar.hamaralabs.com,https://partner.example.com"
// Deliberately NOT a NEXT_PUBLIC_ variable: those are inlined at `next build`
// time (even in server code), so a prebuilt Docker image would ignore the
// runtime .env and the allowlist couldn't be changed without a rebuild.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
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

const isDev = process.env.NODE_ENV === "development"

// Content-Security-Policy for HTML pages. Scripts are locked to a per-request
// nonce (Next.js reads it from the request's CSP header and applies it to its
// own scripts), which blocks injected scripts even if an XSS bug slips in.
// Pages must be dynamically rendered for this — see app/layout.tsx.
function buildCsp(nonce: string, pathname: string) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Components use inline style attributes, which can't carry a nonce (and
    // adding a nonce would make browsers ignore 'unsafe-inline').
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  // The public booking page may be embedded on other sites; everything else
  // must not be framed (clickjacking).
  if (!pathname.startsWith("/schedule/")) directives.push("frame-ancestors 'none'")
  return directives.join("; ")
}

function withCsp(req: NextAuthRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = buildCsp(nonce, req.nextUrl.pathname)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set("Content-Security-Policy", csp)
  return res
}

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith("/api/")) return withCsp(req)

  const origin = req.headers.get("origin")

  // No Origin header means this isn't a cross-site browser request (e.g. a
  // same-origin page load, or a server-to-server caller like the slots API
  // integration) — nothing to check here, let route-level auth decide.
  if (!origin) return NextResponse.next()

  // Browsers also send Origin on same-origin POST/PATCH/DELETE. Sec-Fetch-Site
  // is a forbidden header (page scripts can't set it), so "same-origin" here
  // reliably identifies the app's own pages — no CORS headers needed.
  if (req.headers.get("sec-fetch-site") === "same-origin") return NextResponse.next()

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

export const config = {
  matcher: [
    {
      // Skip static assets, which need neither auth nor a CSP nonce.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      // Skip next/link prefetches, as recommended by the Next.js CSP guide.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
