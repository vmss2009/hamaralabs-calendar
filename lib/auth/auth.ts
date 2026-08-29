import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/db/prisma";
import { authConfig } from "./auth.config";

// Generate a username from email
function generateUsername(email: string): string {
  // Remove everything after @ and special characters
  const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');

  // Add a random number to make it unique
  const randomNum = Math.floor(Math.random() * 1000);
  return `${baseUsername}${randomNum}`;
}

async function generateUniqueUsername(email: string): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts++) {
    const username = generateUsername(email);
    const existing = await prisma.user.findUnique({ where: { username } });
    if (!existing) return username;
  }
  throw new Error("Failed to generate unique username");
}

// The Prisma adapter's createUser() only knows about the fields OAuth
// profiles provide (email, name, image). username is a required column we
// own, so it's injected here before the adapter's insert rather than in a
// separate post-creation update.
const baseAdapter = PrismaAdapter(prisma);
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(user) {
    const username = await generateUniqueUsername(user.email);
    return baseAdapter.createUser!({
      ...user,
      username,
      metadata: { isPublic: true, callOnBook: false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Existing users created before the Prisma adapter was introduced have
      // no linked Account row; allowDangerousEmailAccountLinking on the
      // Authentik provider (the only provider) lets their next login link
      // one automatically instead of failing with OAuthAccountNotLinked.
      return !!user.email;
    },
  },
});
