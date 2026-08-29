import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe NextAuth instance (no Prisma import chain) for use in middleware.
export const { auth } = NextAuth(authConfig);
