import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 flex h-14 items-center justify-between mx-auto max-w-7xl">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight">
              <span className="text-primary">Zenny</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get Started</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/app">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Zenny. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
