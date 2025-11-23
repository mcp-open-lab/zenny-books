"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Receipt } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo/Brand - Centered */}
        <Link href="/app" className="flex items-center gap-2 flex-1 justify-center">
          <Receipt className="h-5 w-5" />
          <span className="font-bold text-sm">Turbo Invoice</span>
        </Link>

        {/* Theme Toggle and User Button - Right */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}

