import NextAuth from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";
import prisma from "@/lib/db/prisma";

// Generate a username from email
function generateUsername(email: string): string {
  // Remove everything after @ and special characters
  const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  
  // Add a random number to make it unique
  const randomNum = Math.floor(Math.random() * 1000);
  return `${baseUsername}${randomNum}`;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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
    }),
  ],
  callbacks: {
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
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id; // Persist the database user ID in the token
        token.sub = profile?.sub as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string; // Pass the database user ID to the session
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin", // Redirect to custom login page
    error: "/auth/error", // Redirect to error page
  },
});