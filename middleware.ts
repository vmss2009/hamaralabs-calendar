import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

const allowedOrigins = (process.env.NEXT_PUBLIC_ALLOWED_ORIGINS || "")
	.split(",")
	.map((o) => o.trim())
	.filter(Boolean);

function isOriginAllowed(origin: string | null): boolean {
	if (!origin) return true; // same-origin/non-browser or server-to-server (no Origin header) -> allow
	if (allowedOrigins.length === 0) return true; // if not configured, allow all (can tighten later)
	return allowedOrigins.includes(origin);
}

function buildCORSHeaders(origin: string | null) {
	const headers: Record<string, string> = {
		"Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
		"Access-Control-Allow-Credentials": "true",
	};
	if (origin && isOriginAllowed(origin)) {
		headers["Access-Control-Allow-Origin"] = origin; // must echo for credentialed requests
		headers["Vary"] = "Origin";
	}
	return headers;
}

export default auth((req: NextRequest) => {
	const { pathname } = req.nextUrl;

	// Only apply explicit CORS handling to API routes; let other routes proceed normally
	if (!pathname.startsWith("/api/")) {
		return NextResponse.next();
	}

	const origin = req.headers.get("origin");
			const isAuthRoute = pathname.startsWith("/api/auth");
			const publicPatterns: RegExp[] = [
				/^\/api\/auth/,
				/^\/api\/users\/[^/]+$/,              // public user profile info
				/^\/api\/schedules\/public\//,       // public schedules
				/^\/api\/bookings$/                   // create booking
			];
			const isPublic = publicPatterns.some(r => r.test(pathname));

	// Preflight request
	if (req.method === "OPTIONS") {
		if (!isOriginAllowed(origin)) {
			return new NextResponse(null, { status: 403 });
		}
		return new NextResponse(null, { status: 204, headers: buildCORSHeaders(origin) });
	}

	if (!isOriginAllowed(origin)) {
		return new NextResponse(
			JSON.stringify({ error: "CORS: Origin not allowed" }),
			{ status: 403, headers: { "Content-Type": "application/json" } }
		);
	}

			// Skip auth requirement for NextAuth endpoints
				if (!isPublic) {
				// Enforce authentication for all other API routes
				const anyReq: any = req as any;
				const session = anyReq.auth; // undefined if not logged in
				if (!session) {
					return new NextResponse(
						JSON.stringify({ error: "Unauthorized" }),
						{ status: 401, headers: { "Content-Type": "application/json" } }
					);
				}
			}

		const res = NextResponse.next();
		const corsHeaders = buildCORSHeaders(origin);
		Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
		return res;
});

// Limit middleware to API routes (adjust if you want to extend protection)
export const config = {
	matcher: ["/api/:path*"],
};
