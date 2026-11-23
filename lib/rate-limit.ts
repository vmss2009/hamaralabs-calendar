// Minimal in-memory fixed-window rate limiter.
//
// State lives in this Node process, so limits reset on restart and are not
// shared between replicas. That's adequate for the single-container
// deployment in docker-compose.yaml; if the app is ever scaled horizontally,
// move this to a shared store (e.g. Redis) or enforce it at the reverse proxy.

type Bucket = { count: number; resetAt: number };

// Hard cap on tracked keys so a flood of distinct (e.g. spoofed) keys can't
// grow memory without bound. Oldest entries are evicted first.
const MAX_KEYS = 50_000;

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  return function check(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();

    if (now - lastSweep > windowMs) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      lastSweep = now;
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (bucket) buckets.delete(key);
      while (buckets.size >= MAX_KEYS) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (bucket.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count++;
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

// Best-effort client IP for rate-limit keys.
//
// Next.js fills X-Forwarded-For with the socket address only when the header
// is absent, and reverse proxies (nginx `$proxy_add_x_forwarded_for`,
// Cloudflare, Caddy) append the address they saw on the right. Entries further
// left are client-supplied and can be forged, so we count TRUSTED_PROXY_HOPS
// entries from the right (default 1 = a single reverse proxy in front of the
// app). Set it to 2 for e.g. Cloudflare -> nginx -> app.
export function getClientIp(headers: Headers): string {
  const hops = Math.max(1, parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10) || 1);
  const chain = (headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length === 0) return "unknown";
  return chain[Math.max(0, chain.length - hops)];
}
