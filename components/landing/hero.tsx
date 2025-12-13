"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingCards } from "@/components/landing/floating-cards";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,hsl(var(--primary)/0.22),transparent_55%),radial-gradient(circle_at_90%_30%,hsl(var(--info)/0.16),transparent_60%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_52%,hsl(var(--background)/0.65)_100%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.08),rgba(255,255,255,0.08)_1px,transparent_1px,transparent_24px)] dark:opacity-[0.06]" />
      </div>

      <div className="container mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08 } },
            }}
          >
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Level up your bookkeeping with{" "}
              <span className="bg-gradient-to-r from-primary via-[hsl(var(--info))] to-primary bg-clip-text text-transparent">
                Zenny
              </span>
              .
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="mx-auto mt-5 max-w-[760px] text-muted-foreground md:text-xl lg:text-2xl"
            >
              Stop manually categorizing transactions.{" "}
              <span className="text-primary font-medium">Zenny</span> captures
              receipts, categorizes spending with smart rules, and keeps you
              tax-ready—so you can focus on what matters.
            </motion.p>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                asChild
                size="lg"
                className="h-12 px-8 text-base zenny-pulse-glow"
              >
                <Link href="/sign-up">
                  Start for Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/app">
                  Go to App <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
              >
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <span className="rounded-full border px-3 py-1">No credit card</span>
              <span className="rounded-full border px-3 py-1">
                Bank-grade security
              </span>
              <span className="rounded-full border px-3 py-1">Plaid connected</span>
            </motion.div>
          </motion.div>

          <FloatingCards className="hidden md:block" />
        </div>
      </div>
    </section>
  );
}


