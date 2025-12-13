import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

export function FinalCta() {
  return (
    <section className="w-full py-12 md:py-24 border-t">
      <div className="container px-4 md:px-6 mx-auto max-w-7xl">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border p-8 md:p-12">
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.22),transparent_55%),radial-gradient(circle_at_80%_30%,hsl(var(--info)/0.16),transparent_60%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_100%)]" />
              <div className="absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.08),rgba(255,255,255,0.08)_1px,transparent_1px,transparent_24px)] dark:opacity-[0.06]" />
            </div>

            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to hand it to Zenny?
                </h2>
                <p className="text-muted-foreground md:text-lg max-w-2xl">
                  Join the first 10,000 users and get Pro free. Start with a
                  clean workflow today—then unlock the full advisor as it rolls
                  out.
                </p>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Join 10,000+</span> freelancers
                  and small business owners (and counting).
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="h-12 px-8 zenny-pulse-glow">
                  <Link href="/sign-up">
                    Start free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" className="h-12 px-8">
                  <Link href="/app">
                    Go to app <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-8">
                  <Link href="/pricing">See pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}


