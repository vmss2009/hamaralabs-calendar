import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./provider";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Calendar App",
  description: "A simple calendar app for managing schedules",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Render every page per request so the CSP nonce set in proxy.ts can be
  // applied to Next.js scripts; statically prerendered HTML can't carry it
  // and would be blocked by the policy.
  await connection();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
