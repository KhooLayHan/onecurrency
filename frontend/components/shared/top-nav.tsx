"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "home", label: "Dashboard", href: "/dashboard" },
  { id: "transfer", label: "Transfer", href: "/transfer" },
  { id: "history", label: "History", href: "/history" },
  { id: "profile", label: "Profile", href: "/profile" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const isAuthenticated = !!session && !isPending;

  return (
    <header className="sticky top-0 z-40 w-full border-border/40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          {/* Brand Logo */}
          <Link className="flex items-center gap-2" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="font-bold text-lg text-primary-foreground">
                1
              </span>
            </div>
            <span className="hidden font-bold text-xl tracking-tight sm:inline-block">
              OneCurrency
            </span>
          </Link>

          {/* Desktop Navigation Links (Hidden on Mobile) */}
          <nav className="hidden items-center gap-6 font-medium text-sm sm:flex">
            {TABS.map(({ id, label, href }) => {
              const isActive = pathname === href;
              return (
                <Link
                  className={cn(
                    "transition-colors hover:text-foreground/80",
                    isActive ? "text-foreground" : "text-foreground/60"
                  )}
                  href={href}
                  key={id}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          {/* Show Sign Out if authenticated, otherwise show login link */}
          {isAuthenticated ? (
            <Button onClick={handleSignOut} size="sm" variant="ghost">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/login">
                <User className="mr-2 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          )}

          {/* The Reown AppKit Connect Button */}
          <appkit-button />
        </div>
      </div>
    </header>
  );
}
