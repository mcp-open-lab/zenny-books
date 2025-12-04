"use client";

import { useState } from "react";
import { createRuleFromTransaction, getSimilarTransactionStats } from "@/app/actions/transactions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface Category {
  id: string;
  name: string;
  transactionType: string;
  type?: string;
}

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantName: string;
  categoryId: string;
  businessId: string | null;
  categories: Category[];
  businesses: Array<{ id: string; name: string }>;
  onRuleCreated?: () => void;
}

export function CreateRuleDialog({
  open,
  onOpenChange,
  merchantName,
  categoryId,
  businessId,
  categories,
  businesses,
  onRuleCreated,
}: CreateRuleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    merchantName: merchantName || "",
    categoryId: categoryId || "",
    businessId: businessId || null,
    displayName: merchantName || "",
    matchType: "contains" as "exact" | "contains",
  });
  const [stats, setStats] = useState<{
    totalCount: number;
    categorizedCount: number;
    mostCommonCategory: { id: string; name: string; count: number } | null;
    mostCommonBusiness: { id: string; name: string; count: number } | null;
  } | null>(null);

  // Fetch stats when dialog opens
  const handleOpenChange = async (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen && merchantName) {
      try {
        const statsData = await getSimilarTransactionStats({ merchantName });
        setStats(statsData);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await createRuleFromTransaction({
        merchantName: formData.merchantName,
        categoryId: formData.categoryId,
        businessId: formData.businessId,
        displayName: formData.displayName,
        matchType: formData.matchType,
      });

      if (result.success) {
        toast.success("Rule created successfully", {
          description: `Future transactions from "${formData.merchantName}" will be automatically categorized.`,
        });
        onOpenChange(false);
        onRuleCreated?.();
      } else {
        toast.error("Failed to create rule", {
          description: result.error || "An error occurred",
        });
      }
    } catch (error) {
      toast.error("Failed to create rule", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Auto-Categorization Rule
          </DialogTitle>
          <DialogDescription>
            Create a rule to automatically categorize future transactions from this merchant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Impact Preview */}
          {stats && stats.totalCount > 0 && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium text-primary mb-1">
                Impact Preview
              </p>
              <p className="text-xs text-muted-foreground">
                This rule will apply to approximately <strong>{stats.totalCount}</strong> existing transaction{stats.totalCount === 1 ? "" : "s"} and all future transactions from this merchant.
              </p>
            </div>
          )}

          {/* Merchant Name */}
          <div className="space-y-2">
            <Label htmlFor="merchantName">Merchant Name</Label>
            <Input
              id="merchantName"
              value={formData.merchantName}
              onChange={(e) =>
                setFormData({ ...formData, merchantName: e.target.value })
              }
              placeholder="e.g., Starbucks"
              required
            />
            <p className="text-xs text-muted-foreground">
              The merchant name pattern to match against
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              placeholder="e.g., Starbucks Coffee"
            />
            <p className="text-xs text-muted-foreground">
              Friendly name for this rule (defaults to merchant name)
            </p>
          </div>

          {/* Match Type */}
          <div className="space-y-2">
            <Label htmlFor="matchType">Match Type</Label>
            <Select
              value={formData.matchType}
              onValueChange={(value: "exact" | "contains") =>
                setFormData({ ...formData, matchType: value })
              }
            >
              <SelectTrigger id="matchType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains (Recommended)</SelectItem>
                <SelectItem value="exact">Exact Match</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              "Contains" matches variations (e.g., "Starbucks #123", "Starbucks Downtown")
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <CategoryCombobox
              value={formData.categoryId}
              onChange={(value) =>
                setFormData({ ...formData, categoryId: value })
              }
              categories={categories}
              placeholder="Select category..."
            />
          </div>

          {/* Business */}
          <div className="space-y-2">
            <Label htmlFor="business">Business (Optional)</Label>
            <Select
              value={formData.businessId || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, businessId: value === "none" ? null : value })
              }
            >
              <SelectTrigger id="business">
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Personal)</SelectItem>
                {businesses.map((biz) => (
                  <SelectItem key={biz.id} value={biz.id}>
                    {biz.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign this merchant to a specific business
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

