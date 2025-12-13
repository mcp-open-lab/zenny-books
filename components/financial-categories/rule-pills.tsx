"use client";

import { cn } from "@/lib/utils";

function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "strong";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        tone === "strong"
          ? "bg-primary/15 text-primary"
          : "bg-muted text-foreground/80",
        className
      )}
    >
      {children}
    </span>
  );
}

export function RulePills({
  enabled,
  ruleLabel,
  categoryName,
  businessName,
}: {
  enabled: boolean;
  ruleLabel: string; // e.g. "Merchant equals"
  categoryName: string; // e.g. "Flights"
  businessName: string; // e.g. "Personal"
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <Pill tone={enabled ? "strong" : "muted"}>{enabled ? "Enabled" : "Disabled"}</Pill>
        <Pill>{ruleLabel}</Pill>
        <Pill>{categoryName}</Pill>
      </div>

      <span className="mx-1 hidden sm:inline-block h-4 w-px bg-border" />

      <div className="flex items-center">
        <Pill className="sm:ml-0">{businessName}</Pill>
      </div>
    </div>
  );
}


