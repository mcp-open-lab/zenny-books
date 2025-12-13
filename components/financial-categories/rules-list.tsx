"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { RulePills } from "@/components/financial-categories/rule-pills";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryAssigner } from "@/components/categorization/category-assigner";
import {
  deleteCategoryRule,
  setCategoryRuleEnabled,
  upsertCategoryRule,
} from "@/app/actions/financial-categories";
import type { categories, categoryRules } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type Category = typeof categories.$inferSelect;
type Rule = typeof categoryRules.$inferSelect;

type RuleRow = { rule: Rule; category: Category };

type Business = { id: string; name: string };

const FIELD_LABEL: Record<string, string> = {
  merchantName: "Merchant",
  description: "Description",
};

function describeRule(rule: Rule): string {
  const field = FIELD_LABEL[rule.field] ?? rule.field;
  const match =
    rule.matchType === "contains"
      ? "contains"
      : rule.matchType === "exact"
        ? "equals"
        : "matches";
  return `${field} ${match}`;
}

type EditState = {
  id: string | null;
  value: string;
  field: "merchantName" | "description";
  matchType: "contains" | "exact" | "regex";
  categoryId: string;
  businessId: string | null;
  displayName: string;
  isEnabled: boolean;
  source: string | null;
};

export function RulesList({
  categories,
  rules,
  businesses = [],
}: {
  categories: Category[];
  rules: RuleRow[];
  businesses?: Business[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [query, setQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    id: null,
    value: "",
    field: "merchantName",
    matchType: "contains",
    categoryId: "",
    businessId: null,
    displayName: "",
    isEnabled: true,
    source: "settings",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter(({ rule, category }) => {
      if (filter === "enabled" && !rule.isEnabled) return false;
      if (filter === "disabled" && rule.isEnabled) return false;
      if (!q) return true;
      const haystack = `${rule.value} ${rule.displayName || ""} ${category.name}`
        .toLowerCase()
        .trim();
      return haystack.includes(q);
    });
  }, [filter, query, rules]);

  const startCreate = () => {
    setEditingId("__new__");
    setEditState({
      id: null,
      value: "",
      field: "merchantName",
      matchType: "contains",
      categoryId: "",
      businessId: null,
      displayName: "",
      isEnabled: true,
      source: "settings",
    });
  };

  const startEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setEditState({
      id: rule.id,
      value: rule.value ?? "",
      field: rule.field as "merchantName" | "description",
      matchType: rule.matchType as "contains" | "exact" | "regex",
      categoryId: rule.categoryId,
      businessId: rule.businessId ?? null,
      displayName: rule.displayName ?? "",
      isEnabled: (rule.isEnabled ?? true) === true,
      source: rule.source ?? null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState({
      id: null,
      value: "",
      field: "merchantName",
      matchType: "contains",
      categoryId: "",
      businessId: null,
      displayName: "",
      isEnabled: true,
      source: "settings",
    });
  };

  const handleSave = () => {
    if (!editState.categoryId || !editState.value.trim()) {
      toast.error("Please select a category and enter a pattern.");
      return;
    }

    startTransition(async () => {
      try {
        await upsertCategoryRule({
          categoryId: editState.categoryId,
          field: editState.field,
          matchType: editState.matchType,
          value: editState.value.trim(),
          businessId: editState.businessId,
          displayName: editState.displayName.trim() || null,
          isEnabled: editState.isEnabled,
          source: editState.source || "settings",
          createdFrom: editState.id,
        });
        toast.success(editState.id ? "Rule updated" : "Rule created");
        cancelEdit();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save rule");
      }
    });
  };

  const handleDelete = (ruleId: string) => {
    if (!confirm("Delete this rule? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteCategoryRule({ ruleId });
        toast.success("Rule deleted");
        cancelEdit();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete rule");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Rules</h2>
          <p className="text-sm text-muted-foreground">
            These rules are applied first during categorization.
          </p>
        </div>

        <Button size="sm" onClick={startCreate} disabled={isPending}>
          New Rule
        </Button>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rules…"
          className="md:max-w-sm"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "enabled" ? "default" : "outline"}
            onClick={() => setFilter("enabled")}
          >
            Enabled
          </Button>
          <Button
            size="sm"
            variant={filter === "disabled" ? "default" : "outline"}
            onClick={() => setFilter("disabled")}
          >
            Disabled
          </Button>
        </div>
      </div>
      </Card>

      {editingId === "__new__" && (
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-medium">New Rule</h3>
              <p className="text-xs text-muted-foreground">
                Create a rule that will be applied first during categorization.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isPending || !editState.categoryId || !editState.value.trim()}>
                Create
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Category
              </label>
              <CategoryAssigner
                value={editState.categoryId}
                onChange={(v) => setEditState((s) => ({ ...s, categoryId: v }))}
                categories={categories}
                merchantName={null}
                showApplyToFuture={false}
                disabled={isPending}
              />
            </div>

            {businesses.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Business (Optional)
                </label>
                <Select
                  value={editState.businessId || "personal"}
                  onValueChange={(v) =>
                    setEditState((s) => ({
                      ...s,
                      businessId: v === "personal" ? null : v,
                    }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Field
              </label>
              <Select
                value={editState.field}
                onValueChange={(v) =>
                  setEditState((s) => ({
                    ...s,
                    field: v as "merchantName" | "description",
                  }))
                }
                disabled={isPending}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merchantName">Merchant</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Match Type
              </label>
              <Select
                value={editState.matchType}
                onValueChange={(v) =>
                  setEditState((s) => ({
                    ...s,
                    matchType: v as "contains" | "exact" | "regex",
                  }))
                }
                disabled={isPending}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="exact">Exact</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Pattern
              </label>
              <Textarea
                value={editState.value}
                onChange={(e) =>
                  setEditState((s) => ({ ...s, value: e.target.value }))
                }
                placeholder={
                  editState.field === "merchantName"
                    ? "e.g., Starbucks"
                    : "e.g., Card purchase"
                }
                className="min-h-[90px]"
                disabled={isPending}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Display Name (Optional)
              </label>
              <Input
                value={editState.displayName}
                onChange={(e) =>
                  setEditState((s) => ({ ...s, displayName: e.target.value }))
                }
                placeholder="Friendly name for this rule"
                disabled={isPending}
              />
            </div>

            <label className="flex items-center justify-between gap-2 text-sm md:col-span-2">
              <span>Enabled</span>
              <Switch
                checked={editState.isEnabled}
                onCheckedChange={(v) =>
                  setEditState((s) => ({ ...s, isEnabled: v }))
                }
                disabled={isPending}
              />
            </label>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No rules found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ rule, category }) => {
            const businessName =
              rule.businessId && businesses.length > 0
                ? businesses.find((b) => b.id === rule.businessId)?.name || null
                : null;
            const isOpen = editingId === rule.id;

            return (
              <Collapsible
                key={rule.id}
                open={isOpen}
                onOpenChange={(open) => {
                  if (!open) {
                    cancelEdit();
                    return;
                  }
                  startEdit(rule);
                }}
              >
                <Card className={cn("p-5", isOpen && "ring-1 ring-border")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <RulePills
                        enabled={!!rule.isEnabled}
                        ruleLabel={describeRule(rule)}
                        categoryName={category.name}
                        businessName={businessName || "Personal"}
                      />

                      <div className="space-y-1">
                        {(() => {
                          const title = (rule.displayName || "").trim();
                          const pattern = (rule.value || "").trim();
                          const hasDistinctTitle =
                            title.length > 0 &&
                            pattern.length > 0 &&
                            title.toLowerCase() !== pattern.toLowerCase();

                          const primaryLine = hasDistinctTitle ? title : pattern;

                          return (
                            <>
                              <div className="text-sm font-medium truncate">
                                {primaryLine || "Untitled rule"}
                              </div>

                              {hasDistinctTitle && (
                                <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words line-clamp-2">
                                  {pattern}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {rule.source ? (
                          <div className="text-xs text-muted-foreground">
                            Source: {rule.source}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={!!rule.isEnabled}
                        onCheckedChange={(v) => {
                          startTransition(async () => {
                            try {
                              await setCategoryRuleEnabled({
                                ruleId: rule.id,
                                isEnabled: v,
                              });
                              router.refresh();
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : "Failed to update rule"
                              );
                            }
                          });
                        }}
                        disabled={isPending}
                      />
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                          {isOpen ? "Close" : "Edit"}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>

                  <CollapsibleContent className="pt-4">
                    <Separator className="mb-4" />

                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-medium">Edit Rule</h4>
                        <p className="text-xs text-muted-foreground">
                          Make changes, then save.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEdit}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={
                            isPending ||
                            !editState.categoryId ||
                            !editState.value.trim()
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Category
                        </label>
                        <CategoryAssigner
                          value={editState.categoryId}
                          onChange={(v) =>
                            setEditState((s) => ({ ...s, categoryId: v }))
                          }
                          categories={categories}
                          merchantName={null}
                          showApplyToFuture={false}
                          disabled={isPending}
                        />
                      </div>

                      {businesses.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            Business (Optional)
                          </label>
                          <Select
                            value={editState.businessId || "personal"}
                            onValueChange={(v) =>
                              setEditState((s) => ({
                                ...s,
                                businessId: v === "personal" ? null : v,
                              }))
                            }
                            disabled={isPending}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select business" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="personal">Personal</SelectItem>
                              {businesses.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Field
                        </label>
                        <Select
                          value={editState.field}
                          onValueChange={(v) =>
                            setEditState((s) => ({
                              ...s,
                              field: v as "merchantName" | "description",
                            }))
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="merchantName">Merchant</SelectItem>
                            <SelectItem value="description">Description</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Match Type
                        </label>
                        <Select
                          value={editState.matchType}
                          onValueChange={(v) =>
                            setEditState((s) => ({
                              ...s,
                              matchType: v as "contains" | "exact" | "regex",
                            }))
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="exact">Exact</SelectItem>
                            <SelectItem value="regex">Regex</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Pattern
                        </label>
                        <Textarea
                          value={editState.value}
                          onChange={(e) =>
                            setEditState((s) => ({ ...s, value: e.target.value }))
                          }
                          className="min-h-[110px] font-mono text-xs"
                          disabled={isPending}
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Display Name (Optional)
                        </label>
                        <Input
                          value={editState.displayName}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              displayName: e.target.value,
                            }))
                          }
                          disabled={isPending}
                        />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-between">
                        <label className="text-sm">Enabled</label>
                        <Switch
                          checked={editState.isEnabled}
                          onCheckedChange={(v) =>
                            setEditState((s) => ({ ...s, isEnabled: v }))
                          }
                          disabled={isPending}
                        />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-between border-t pt-3">
                        <div className="text-xs text-muted-foreground">
                          Source: {rule.source || "—"}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
                          disabled={isPending}
                        >
                          Delete Rule
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}


