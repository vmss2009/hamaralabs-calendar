"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationProps {
  username?: string;
}

export default function Navigation({ username }: NavigationProps) {
  const pathname = usePathname();
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch current visibility once (best-effort; tolerate pre-migration absence)
  useEffect(() => {
    async function load() {
      if (!username) return;
      try {
        const res = await fetch(`/api/users/${username}`);
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.isPublic === "boolean") {
          setIsPublic(data.isPublic);
        } else {
          setIsPublic(true); // default public if not set
        }
      } catch { /* ignore */ }
    }
    load();
  }, [username]);

  // Close the mobile menu with Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function toggleVisibility() {
    if (isPublic == null) return;
    try {
      setSaving(true);
      const res = await fetch("/api/users/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (typeof data.isPublic === "boolean") setIsPublic(data.isPublic);
    } catch {
      // optimistic revert
    } finally {
      setSaving(false);
    }
  }

  const isActive = (href: string) => pathname === href;

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    background: active
      ? "color-mix(in srgb, var(--foreground) 12%, transparent)"
      : "transparent",
    color: "var(--foreground)",
    borderColor: active
      ? "color-mix(in srgb, var(--foreground) 30%, transparent)"
      : "color-mix(in srgb, var(--foreground) 18%, transparent)",
  });

  const navItemClass =
    "px-3 py-2 rounded-md text-sm font-medium border transition-colors hover:[background:color-mix(in_srgb,var(--foreground)_8%,transparent)]";

  const solidButtonStyle: React.CSSProperties = {
    background: "var(--foreground)",
    color: "var(--background)",
  };

  const subtleBorder = "color-mix(in srgb, var(--foreground) 15%, transparent)";

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    ...(username ? [{ href: `/schedule/${username}`, label: "Public link" }] : []),
  ];

  // Shared by the desktop bar and the mobile menu (only one is visible at a time).
  const visibilityToggle = isPublic !== null && (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={toggleVisibility}
        disabled={saving}
        role="switch"
        aria-checked={isPublic}
        aria-label="Public profile"
        title={isPublic ? "Public - click to make private" : "Private - click to make public"}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full",
          "border ring-1 ring-inset transition-all duration-200",
          isPublic
            ? "bg-[color-mix(in_srgb,var(--foreground)_14%,transparent)]"
            : "bg-transparent",
          "border-[color-mix(in_srgb,var(--foreground)_25%,transparent)]",
          "ring-[color-mix(in_srgb,var(--foreground)_18%,transparent)]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--foreground)_40%,transparent)]",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full",
            "bg-[var(--background)] shadow-sm transition-transform duration-200 will-change-transform",
            isPublic ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>

      <span className="w-14 text-sm font-medium text-[var(--foreground)] select-none">
        {saving ? "Saving..." : isPublic ? "Public" : "Private"}
      </span>
    </div>
  );

  return (
    <nav
      className="w-full"
      style={{
        background: "var(--background)",
        borderBottom: `1px solid ${subtleBorder}`,
      }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center gap-3">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/dashboard"
              className="truncate text-lg sm:text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Calendar App
            </Link>

            <div className="hidden md:flex items-center gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={navItemClass}
                  style={navItemStyle(isActive(link.href))}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right */}
          {username ? (
            <>
              {/* Desktop */}
              <div className="hidden md:flex min-w-0 items-center gap-3">
                <span
                  className="max-w-[12rem] truncate text-sm"
                  style={{ color: "var(--foreground)" }}
                  title={username}
                >
                  {username}
                </span>
                {visibilityToggle}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-3 py-2 rounded-md text-sm font-medium transition-opacity"
                  style={solidButtonStyle}
                >
                  Sign Out
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className={cn(navItemClass, "md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center p-0")}
                style={navItemStyle(menuOpen)}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="shrink-0 px-3 py-2 rounded-md text-sm font-medium"
              style={solidButtonStyle}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Mobile menu panel */}
      {username && menuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden"
          style={{ borderTop: `1px solid ${subtleBorder}` }}
        >
          <div className="container mx-auto flex flex-col gap-2 px-4 pt-3 pb-4">
            <p className="truncate px-1 pb-1 text-sm" style={{ color: "var(--foreground)" }}>
              <span className="opacity-60">Signed in as </span>
              <span className="font-medium">{username}</span>
            </p>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(navItemClass, "block w-full py-3")}
                style={navItemStyle(isActive(link.href))}
              >
                {link.label}
              </Link>
            ))}

            {visibilityToggle && (
              <div
                className="flex items-center justify-between rounded-md border px-3 py-2"
                style={{ borderColor: "color-mix(in srgb, var(--foreground) 18%, transparent)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Profile visibility
                </span>
                {visibilityToggle}
              </div>
            )}

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-1 w-full rounded-md px-3 py-3 text-sm font-medium transition-opacity"
              style={solidButtonStyle}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
