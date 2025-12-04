"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, Upload, Settings, Wallet, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", icon: Home, label: "Timeline" },
  { href: "/app/review", icon: AlertCircle, label: "Review" },
  { href: "/app/budgets", icon: Wallet, label: "Budget" },
  { href: "/app/import", icon: Upload, label: "Import" },
  { href: "/app/settings", icon: Settings, label: "Settings" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
            (item.href !== "/app" && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium transition-colors min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

