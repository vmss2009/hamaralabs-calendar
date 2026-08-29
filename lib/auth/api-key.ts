import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

// Verifies the shared-secret header used by server-to-server callers
// (e.g. the merchant/payment system posting to /api/slots). Not used for
// browser-facing routes, which authenticate via the NextAuth session instead.
export function isValidApiKey(req: NextRequest): boolean {
  const expected = process.env.SLOTS_API_KEY;
  if (!expected) return false;

  const provided = req.headers.get("x-api-key");
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
