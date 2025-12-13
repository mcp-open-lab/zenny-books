"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { testRuleMatch } from "@/lib/modules/categories/actions";
import type { CategorizationResult } from "@/lib/categorization/types";

export function RuleTester() {
  const [isPending, startTransition] = useTransition();
  const [merchantName, setMerchantName] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<CategorizationResult | null>(null);

  const run = () => {
    startTransition(async () => {
      const res = await testRuleMatch({
        merchantName: merchantName.trim() || null,
        description: description.trim() || null,
      });
      setResult(res);
    });
  };

  return (
    <Card className="p-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Test a Rule</h2>
        <p className="text-sm text-muted-foreground">
          Preview what the rule matcher would do for an incoming transaction.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Merchant Name
          </label>
          <Input
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            placeholder="e.g., Starbucks"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Card purchase"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={run} disabled={isPending}>
          {isPending ? "Testing…" : "Test"}
        </Button>
        {result ? (
          <div className="text-sm">
            {result.method === "rule" && result.categoryName ? (
              <span className="flex items-center gap-2">
                <Badge variant="outline">Matched</Badge>
                <span className="text-muted-foreground">
                  Category:{" "}
                  <span className="font-medium text-foreground">
                    {result.categoryName}
                  </span>
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Badge variant="secondary">No Match</Badge>
                <span className="text-muted-foreground">
                  No enabled rule matched.
                </span>
              </span>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}


