"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Clock,
  ArrowDownToLine,
  ArrowUpToLine,
  Wallet,
  FileText,
  Settings,
  Brain,
  Receipt,
  BarChart3,
  AlertCircle,
  Sparkles,
  Database,
} from "lucide-react";

const mainItems = [
  {
    label: "Timeline",
    href: "/app",
    icon: Clock,
    description: "View all transactions",
  },
  {
    label: "Review",
    href: "/app/review",
    icon: AlertCircle,
    description: "Categorize & organize",
  },
];

const insightsItems = [
  {
    label: "Analytics",
    href: "/app/analytics",
    icon: BarChart3,
    description: "AI-powered insights",
  },
  {
    label: "Budgets",
    href: "/app/budgets",
    icon: Wallet,
    description: "Track spending goals",
  },
  {
    label: "Invoices",
    href: "/app/invoices",
    icon: FileText,
    description: "Manage invoices",
  },
];

const dataItems = [
  {
    label: "Import",
    href: "/app/import",
    icon: ArrowDownToLine,
    description: "Upload documents",
  },
  {
    label: "Export",
    href: "/app/export",
    icon: ArrowUpToLine,
    description: "Download reports",
  },
];

export function DesktopNav() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isActiveGroup = (items: typeof mainItems) => {
    return items.some(
      (item) =>
        pathname === item.href ||
        (item.href !== "/app" && pathname?.startsWith(item.href))
    );
  };

  // Prevent hydration mismatch by only rendering NavigationMenu on client
  if (!isMounted) {
    return (
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4 mx-auto">
          <Link href="/app" className="flex items-center space-x-2 flex-shrink-0">
            <Receipt className="h-6 w-6" />
            <span className="font-bold text-lg">Turbo Invoice</span>
          </Link>
          <div className="flex items-center gap-3 flex-shrink-0">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-16 items-center justify-between px-6 max-w-[1800px] mx-auto">
        {/* Logo/Brand */}
        <Link href="/app" className="flex items-center space-x-2 flex-shrink-0">
          <Receipt className="h-6 w-6" />
          <span className="font-bold text-lg">Turbo Invoice</span>
        </Link>

        {/* Navigation Menu - Centered */}
        <NavigationMenu className="mx-auto">
          <NavigationMenuList>
            {/* Main Pages */}
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/app" && pathname?.startsWith(item.href));

              return (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        isActive && "bg-accent"
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}

            {/* Insights Dropdown */}
            <NavigationMenuItem>
              <NavigationMenuTrigger
                className={isActiveGroup(insightsItems) ? "bg-accent" : ""}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Insights
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
                  {insightsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                              pathname?.startsWith(item.href) && "bg-accent"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <div className="text-sm font-medium leading-none">
                                {item.label}
                              </div>
                              <Brain className="h-3 w-3 text-primary ml-auto" />
                            </div>
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                              {item.description}
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Data Dropdown */}
            <NavigationMenuItem>
              <NavigationMenuTrigger
                className={isActiveGroup(dataItems) ? "bg-accent" : ""}
              >
                <Database className="h-4 w-4 mr-2" />
                Data
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4">
                  {dataItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                              pathname?.startsWith(item.href) && "bg-accent"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <div className="text-sm font-medium leading-none">
                                {item.label}
                              </div>
                            </div>
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                              {item.description}
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Settings */}
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  href="/app/settings"
                  className={cn(
                    navigationMenuTriggerStyle(),
                    pathname?.startsWith("/app/settings") && "bg-accent"
                  )}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* User Menu - Only visible on desktop (md+) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <ThemeToggle />
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
