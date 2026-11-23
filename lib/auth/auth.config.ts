import type { NextAuthConfig } from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";

// Session storage is database-backed (see auth.ts, where the Prisma adapter
// is attached) rather than JWT, so sessions can be revoked server-side by
// deleting the Session row instead of just waiting out a signed cookie.
export const authConfig: NextAuthConfig = {
  providers: [
    AuthentikProvider({
      id: "authentik",
      name: "Authentik",
      clientId: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
      issuer: process.env.AUTHENTIK_ISSUER,
      authorization: {
        url: `${process.env.AUTHENTIK_URL}/authorize/`,
        params: { scope: "openid email profile" },
      },
      token: `${process.env.AUTHENTIK_URL}/token/`,
      userinfo: `${process.env.AUTHENTIK_URL}/userinfo/`,
      profile(profile) {
        return {
          name: profile.name,
          email: profile.email,
        };
      },
      // Authentik is the sole provider and the source of truth for email
      // ownership, so it's safe to auto-link its account to an existing
      // User row by email. This is also what lets accounts created before
      // the Prisma adapter existed (no Account row yet) keep working on
      // their next login instead of failing with OAuthAccountNotLinked.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // Only invoked for database session strategy (an adapter is attached).
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  // `secret` is intentionally not set here: next-auth reads AUTH_SECRET
  // (falling back to NEXTAUTH_SECRET) and supports AUTH_SECRET_1..n rotation.
  pages: {
    signIn: "/auth/signin", // Redirect to custom login page
    error: "/auth/error", // Redirect to error page
  },
};
