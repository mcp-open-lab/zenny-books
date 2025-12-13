"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { TransactionType } from "@/lib/modules/transactions/actions";
import { updateTransaction } from "@/lib/modules/transactions/actions";
import { createRuleFromTransaction } from "@/lib/modules/transactions/actions";

export type CategoryAssignmentResult = { success: boolean; error?: string };

export function useCategoryAssignment(options?: {
  initialCategoryId?: string | null;
  initialBusinessId?: string | null;
  initialApplyToFuture?: boolean;
}) {
  const [categoryId, setCategoryId] = useState<string>(
    options?.initialCategoryId ?? ""
  );
  const [businessId, setBusinessId] = useState<string | null>(
    options?.initialBusinessId ?? null
  );
  const [applyToFuture, setApplyToFuture] = useState<boolean>(
    options?.initialApplyToFuture ?? true
  );
  const [isPending, startTransition] = useTransition();

  const assignCategory = useCallback(
    async (input: {
      id: string;
      type: TransactionType;
      merchantName?: string | null;
      categoryId?: string;
      businessId?: string | null;
      applyToFuture?: boolean;
    }): Promise<CategoryAssignmentResult> => {
      const effectiveCategoryId = input.categoryId ?? categoryId;
      const effectiveBusinessId =
        input.businessId !== undefined ? input.businessId : businessId;
      const effectiveApplyToFuture =
        input.applyToFuture !== undefined ? input.applyToFuture : applyToFuture;
      const merchantName = input.merchantName?.trim() || "";

      if (!effectiveCategoryId) {
        return { success: false, error: "Please select a category" };
      }

      let resolve: (value: CategoryAssignmentResult) => void;
      const promise = new Promise<CategoryAssignmentResult>((r) => {
        resolve = r;
      });

      startTransition(async () => {
        const result = await updateTransaction({
          id: input.id,
          type: input.type,
          categoryId: effectiveCategoryId,
          businessId: effectiveBusinessId ?? null,
          merchantName: merchantName || undefined,
        });

        if (!result.success) {
          const error = result.error || "Failed to update";
          toast.error(error);
          resolve({ success: false, error });
          return;
        }

        // Best-effort: persist override as a merchant rule for future imports
        if (effectiveApplyToFuture && merchantName) {
          const ruleResult = await createRuleFromTransaction({
            merchantName,
            categoryId: effectiveCategoryId,
            businessId: effectiveBusinessId ?? null,
            matchType: "contains",
            displayName: merchantName,
            source: "assignment",
            createdFrom: input.id,
          });

          if (!ruleResult?.success) {
            // Do not fail the transaction update if rule creation fails.
            toast.error(
              ruleResult?.error ||
                "Updated, but failed to save the rule for future transactions"
            );
          }
        }

        resolve({ success: true });
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return promise;
    },
    [applyToFuture, businessId, categoryId]
  );

  return {
    categoryId,
    setCategoryId,
    businessId,
    setBusinessId,
    applyToFuture,
    setApplyToFuture,
    isPending,
    assignCategory,
  };
}
