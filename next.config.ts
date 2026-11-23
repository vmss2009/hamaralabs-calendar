import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Block framing (clickjacking) on everything except the public booking page,
// which may legitimately be embedded on other sites. This is the legacy
// header; the full Content-Security-Policy (including frame-ancestors) is set
// per request in proxy.ts because it carries a nonce.
const noFramingHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
    output: "standalone",
    poweredByHeader: false,
    async headers() {
        return [
            { source: "/:path*", headers: securityHeaders },
            { source: "/((?!schedule/).*)", headers: noFramingHeaders },
        ];
    },
};

export default nextConfig;
