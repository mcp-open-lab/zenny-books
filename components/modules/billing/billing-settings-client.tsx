"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createBillingPortalSession,
  createModuleCheckoutSession,
} from "@/lib/modules/billing/actions";
import type { ModuleSlug, UsageMetric } from "@/lib/modules/types";

type ModuleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPrice: number | null;
  stripePriceId: string | null;
  isActive: boolean;
};

type EntitlementRow = {
  moduleId: string;
  enabled: boolean;
  source: string;
};

type UsageRow = {
  metric: string;
  count: number;
  limit: number;
};

function formatDollars(cents: number | null): string {
  if (!cents || cents <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function BillingSettingsClient({
  modules,
  entitlements,
  usage,
}: {
  modules: ModuleRow[];
  entitlements: EntitlementRow[];
  usage: UsageRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const entitlementByModuleId = useMemo(() => {
    const map = new Map<string, EntitlementRow>();
    for (const e of entitlements) map.set(e.moduleId, e);
    return map;
  }, [entitlements]);

  const usageByMetric = useMemo(() => {
    const map = new Map<string, UsageRow>();
    for (const u of usage) map.set(u.metric, u);
    return map;
  }, [usage]);

  const paidModules = modules.filter((m) => m.slug !== "core");
  const core = modules.find((m) => m.slug === "core");

  const toggleSelected = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const startCheckout = () => {
    const moduleSlugs = Array.from(selected) as ModuleSlug[];
    if (moduleSlugs.length === 0) {
      toast.error("Select at least one module");
      return;
    }

    startTransition(async () => {
      const result = await createModuleCheckoutSession({ moduleSlugs });
      if (!result.success || !result.url) {
        toast.error(result.error || "Failed to start checkout");
        return;
      }
      window.location.href = result.url;
    });
  };

  const openPortal = () => {
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if (!result.success || !result.url) {
        toast.error(result.error || "Failed to open billing portal");
        return;
      }
      window.location.href = result.url;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enable only the modules you need. Free tier includes core features with
          monthly usage limits.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium">
              {core ? core.name : "Core"} (Free)
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {core?.description || "Basics: timeline, categorization, rules, export"}
            </div>
          </div>
          <div className="text-sm font-medium">Included</div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(["transactions", "receipts"] as UsageMetric[]).map((metric) => {
            const row = usageByMetric.get(metric);
            const count = row?.count ?? 0;
            const limit = row?.limit ?? 0;
            return (
              <div key={metric} className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground capitalize">
                  {metric}
                </div>
                <div className="mt-1 text-sm font-medium">
                  {count}/{limit || "—"} this month
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add-on modules</h2>
          <Button variant="outline" onClick={openPortal} disabled={isPending}>
            Manage subscription
          </Button>
        </div>

        <div className="grid gap-3">
          {paidModules.map((m) => {
            const entitled = entitlementByModuleId.has(m.id);
            const isSelected = selected.has(m.slug);
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{m.name}</div>
                      {entitled ? <span className="text-xs text-muted-foreground">
                          Enabled
                        </span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {m.description}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-sm font-medium">
                      {formatDollars(m.monthlyPrice)}
                      <span className="text-muted-foreground text-xs">/mo</span>
                    </div>
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => toggleSelected(m.slug)}
                      disabled={isPending || entitled || !m.stripePriceId}
                      title={
                        !m.stripePriceId
                          ? "Not yet configured"
                          : entitled
                            ? "Already enabled"
                            : undefined
                      }
                    >
                      {entitled ? "Enabled" : isSelected ? "Selected" : "Select"}
                    </Button>
                  </div>
                </div>

                {!m.stripePriceId && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Billing for this module is not configured yet.
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            onClick={startCheckout}
            disabled={isPending || selected.size === 0}
          >
            {isPending ? "Loading…" : "Continue to checkout"}
          </Button>
        </div>
      </div>
    </div>
  );
}


