"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  Clock,
  ArrowDownToLine,
  ArrowUpToLine,
  Wallet,
  FileText,
  Settings,
  Brain,
  Receipt,
} from "lucide-react";

const navItems = [
  {
    label: "Timeline",
    href: "/app",
    icon: Clock,
    showAiIcon: false,
  },
  {
    label: "Budgets",
    href: "/app/budgets",
    icon: Wallet,
    showAiIcon: true,
  },
  {
    label: "Invoices",
    href: "/app/invoices",
    icon: FileText,
    showAiIcon: true,
  },
  {
    label: "Import",
    href: "/app/import",
    icon: ArrowDownToLine,
    showAiIcon: false,
  },
  {
    label: "Export",
    href: "/app/export",
    icon: ArrowUpToLine,
    showAiIcon: false,
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: Settings,
    showAiIcon: false,
  },
];

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex fixed top-0 left-0 right-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-16 items-center justify-between px-6 max-w-[1800px] mx-auto">
        {/* Logo/Brand */}
        <Link href="/app" className="flex items-center space-x-2 flex-shrink-0">
          <Receipt className="h-6 w-6" />
          <span className="font-bold text-lg">Turbo Invoice</span>
        </Link>

        {/* Navigation Links - Centered */}
        <div className="flex items-center space-x-1 mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/app" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.showAiIcon && (
                  <Brain className="h-3.5 w-3.5 text-primary" />
                )}
              </Link>
            );
          })}
        </div>

        {/* User Menu - Only visible on desktop (lg+) */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
              },
            }}
          />
        </div>
      </div>
    </nav>
  );
}
