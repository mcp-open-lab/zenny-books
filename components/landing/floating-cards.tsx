"use client";

import { cn } from "@/lib/utils";

type MiniCard = {
  label: string;
  value: string;
  hint: string;
};

const cards: MiniCard[] = [
  { label: "Categorized", value: "94%", hint: "Rules + AI confidence" },
  { label: "Ready for export", value: "1 click", hint: "CSV / Excel" },
  { label: "Review Queue", value: "7 items", hint: "Clear in minutes" },
];

export function FloatingCards({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto mt-10 w-full max-w-3xl", className)}>
      <div
        className={cn(
          "zenny-float-slow absolute left-0 top-6 w-[240px] rounded-2xl border bg-background/60 p-4 shadow-lg backdrop-blur",
          "dark:bg-background/30"
        )}
      >
        <div className="text-xs text-muted-foreground">{cards[0].label}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          {cards[0].value}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{cards[0].hint}</div>
      </div>

      <div
        className={cn(
          "zenny-float relative mx-auto w-[280px] rounded-2xl border bg-background/70 p-5 shadow-xl backdrop-blur",
          "dark:bg-background/35"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{cards[1].label}</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">
              {cards[1].value}
            </div>
          </div>
          <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
            Live
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{cards[1].hint}</div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[78%] rounded-full bg-primary/80" />
        </div>
      </div>

      <div
        className={cn(
          "zenny-float-slow absolute right-0 top-12 w-[240px] rounded-2xl border bg-background/60 p-4 shadow-lg backdrop-blur",
          "dark:bg-background/30"
        )}
      >
        <div className="text-xs text-muted-foreground">{cards[2].label}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          {cards[2].value}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{cards[2].hint}</div>
      </div>
    </div>
  );
}


