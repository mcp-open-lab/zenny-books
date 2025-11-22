"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  createUserCategory,
  deleteUserCategory,
  createCategoryRule,
  deleteCategoryRule,
} from "@/app/actions/categories";
import type { categories, categoryRules } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;
type CategoryRule = typeof categoryRules.$inferSelect;

type CategoriesManagerProps = {
  categories: Category[];
  rules: Array<{ rule: CategoryRule; category: Category }>;
};

export function CategoriesManager({
  categories: initialCategories,
  rules: initialRules,
}: CategoriesManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState("");
  const [newRuleField, setNewRuleField] = useState<
    "merchantName" | "description"
  >("merchantName");
  const [newRuleMatchType, setNewRuleMatchType] = useState<
    "exact" | "contains" | "regex"
  >("contains");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

  const systemCategories = initialCategories.filter((c) => c.type === "system");
  const userCategories = initialCategories.filter((c) => c.type === "user");

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    startTransition(async () => {
      try {
        await createUserCategory({ name: newCategoryName.trim() });
        toast.success("Category created!");
        setNewCategoryName("");
        setCategoryDialogOpen(false);
        // Refresh the page to show the new category
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create category"
        );
      }
    });
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    if (!confirm(`Delete "${categoryName}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteUserCategory({ categoryId });
        toast.success("Category deleted");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete category"
        );
      }
    });
  };

  const handleCreateRule = () => {
    if (!newRuleCategoryId || !newRuleValue.trim()) {
      toast.error("Please fill all fields");
      return;
    }

    startTransition(async () => {
      try {
        await createCategoryRule({
          categoryId: newRuleCategoryId,
          matchType: newRuleMatchType,
          field: newRuleField,
          value: newRuleValue.trim(),
        });
        toast.success("Rule created!");
        setNewRuleValue("");
        setRuleDialogOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create rule"
        );
      }
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm("Delete this rule? This cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteCategoryRule({ ruleId });
        toast.success("Rule deleted");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete rule"
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Categories Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Categories</h2>
            <p className="text-sm text-muted-foreground">
              System categories are provided by default. You can create custom
              categories.
            </p>
          </div>
          <Dialog
            open={categoryDialogOpen}
            onOpenChange={setCategoryDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Category</DialogTitle>
                <DialogDescription>
                  Add a new category for organizing your expenses
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Category name (e.g., Gym Membership)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCategory();
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateCategory}
                  disabled={isPending || !newCategoryName.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">System Categories</h3>
            <div className="flex flex-wrap gap-2">
              {systemCategories.map((category) => (
                <Badge key={category.id} variant="secondary">
                  <Tag className="h-3 w-3 mr-1" />
                  {category.name}
                </Badge>
              ))}
            </div>
          </div>

          {userCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">
                Your Custom Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {userCategories.map((category) => (
                  <Badge key={category.id} variant="outline" className="pr-1">
                    <Tag className="h-3 w-3 mr-1" />
                    {category.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-2 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() =>
                        handleDeleteCategory(category.id, category.name)
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Rules Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Auto-Categorization Rules</h2>
            <p className="text-sm text-muted-foreground">
              Create rules to automatically categorize transactions based on
              merchant or description
            </p>
          </div>
          <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Auto-Categorization Rule</DialogTitle>
                <DialogDescription>
                  Define a pattern to match transactions to a category
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={newRuleCategoryId}
                    onValueChange={setNewRuleCategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {initialCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name} {cat.type === "system" ? "(System)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Match Field</label>
                  <Select
                    value={newRuleField}
                    onValueChange={(v) => setNewRuleField(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merchantName">
                        Merchant Name
                      </SelectItem>
                      <SelectItem value="description">Description</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Match Type</label>
                  <Select
                    value={newRuleMatchType}
                    onValueChange={(v) => setNewRuleMatchType(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Pattern</label>
                  <Input
                    placeholder={
                      newRuleMatchType === "contains"
                        ? "e.g., Starbucks"
                        : newRuleMatchType === "exact"
                        ? "e.g., STARBUCKS COFFEE"
                        : "e.g., ^STARBUCKS.*"
                    }
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateRule}
                  disabled={
                    isPending || !newRuleCategoryId || !newRuleValue.trim()
                  }
                >
                  Create Rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {initialRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>
              No rules yet. Create your first rule to automate categorization!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {initialRules.map(({ rule, category }) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{category.name}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {rule.field === "merchantName"
                        ? "Merchant"
                        : "Description"}{" "}
                      {rule.matchType === "contains"
                        ? "contains"
                        : rule.matchType === "exact"
                        ? "equals"
                        : "matches"}{" "}
                      <code className="px-1 py-0.5 bg-muted rounded text-xs">
                        {rule.value}
                      </code>
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
