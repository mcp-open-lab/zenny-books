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
import { Plus, Trash2 } from "lucide-react";
import type { categories, categoryRules } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;
type CategoryRule = typeof categoryRules.$inferSelect;

type RulesSectionProps = {
  categories: Category[];
  rules: Array<{ rule: CategoryRule; category: Category }>;
  isPending: boolean;
  newRuleCategoryId: string;
  setNewRuleCategoryId: (id: string) => void;
  newRuleField: "merchantName" | "description";
  setNewRuleField: (field: "merchantName" | "description") => void;
  newRuleMatchType: "exact" | "contains" | "regex";
  setNewRuleMatchType: (type: "exact" | "contains" | "regex") => void;
  newRuleValue: string;
  setNewRuleValue: (value: string) => void;
  ruleDialogOpen: boolean;
  setRuleDialogOpen: (open: boolean) => void;
  handleCreateRule: () => void;
  handleDeleteRule: (ruleId: string) => void;
  getRulePlaceholder: () => string;
};

export function RulesSection({
  categories,
  rules,
  isPending,
  newRuleCategoryId,
  setNewRuleCategoryId,
  newRuleField,
  setNewRuleField,
  newRuleMatchType,
  setNewRuleMatchType,
  newRuleValue,
  setNewRuleValue,
  ruleDialogOpen,
  setRuleDialogOpen,
  handleCreateRule,
  handleDeleteRule,
  getRulePlaceholder,
}: RulesSectionProps) {
  return (
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
                    {categories.map((cat) => (
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
                    <SelectItem value="merchantName">Merchant Name</SelectItem>
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
                  placeholder={getRulePlaceholder()}
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

      {rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No rules yet. Create your first rule to automate categorization!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(({ rule, category }) => (
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
  );
}

