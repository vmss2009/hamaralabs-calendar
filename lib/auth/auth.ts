import NextAuth from "next-auth";
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      try {
        // Check if user exists in database
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // If user doesn't exist, create them with a generated username
        if (!dbUser) {
          let username = generateUsername(user.email);
          let isUsernameTaken = true;
          let attempts = 0;

          // Keep trying until we find a unique username
          while (isUsernameTaken && attempts < 10) {
            const existingUser = await prisma.user.findUnique({
              where: { username },
            });

            if (!existingUser) {
              isUsernameTaken = false;
            } else {
              username = generateUsername(user.email);
              attempts++;
            }
          }

          if (isUsernameTaken) {
            console.error("Failed to generate unique username");
            return false;
          }

          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || null,
              username,
              metadata: {
                isPublic: true,
                callOnBook: false,
              },
            },
          });
        }

        // Add the database user ID to the user object
        user.id = dbUser.id;
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
  },
});
