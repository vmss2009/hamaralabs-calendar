"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface NavigationProps {
  username?: string;
}

export default function Navigation({ username }: NavigationProps) {
  const pathname = usePathname();
  
  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              Calendar App
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link 
                href="/dashboard" 
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === "/dashboard" 
                    ? "bg-blue-100 text-blue-700" 
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Dashboard
              </Link>
              {username && (
                <Link 
                  href={`/schedule/${username}`} 
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === `/schedule/${username}` 
                      ? "bg-blue-100 text-blue-700" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Public link
                </Link>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {username ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {username}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 