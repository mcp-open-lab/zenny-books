import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Tag, TrendingUp, TrendingDown } from "lucide-react";
import type { categories } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;

type CategoriesSectionProps = {
  systemCategories: Category[];
  userCategories: Category[];
  isPending: boolean;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  newCategoryTransactionType: "income" | "expense";
  setNewCategoryTransactionType: (type: "income" | "expense") => void;
  newCategoryUsageScope: "personal" | "business" | "both";
  setNewCategoryUsageScope: (scope: "personal" | "business" | "both") => void;
  newCategoryDescription: string;
  setNewCategoryDescription: (description: string) => void;
  categoryDialogOpen: boolean;
  setCategoryDialogOpen: (open: boolean) => void;
  handleCreateCategory: () => void;
  handleDeleteCategory: (categoryId: string, categoryName: string) => void;
};

export function CategoriesSection({
  systemCategories,
  userCategories,
  isPending,
  newCategoryName,
  setNewCategoryName,
  newCategoryTransactionType,
  setNewCategoryTransactionType,
  newCategoryUsageScope,
  setNewCategoryUsageScope,
  newCategoryDescription,
  setNewCategoryDescription,
  categoryDialogOpen,
  setCategoryDialogOpen,
  handleCreateCategory,
  handleDeleteCategory,
}: CategoriesSectionProps) {
  // Organize system categories by type and scope
  const incomePersonal = systemCategories.filter(
    (c) => c.transactionType === "income" && c.usageScope === "personal"
  );
  const incomeBusiness = systemCategories.filter(
    (c) => c.transactionType === "income" && c.usageScope === "business"
  );
  const incomeBoth = systemCategories.filter(
    (c) => c.transactionType === "income" && c.usageScope === "both"
  );

  const expensePersonal = systemCategories.filter(
    (c) => c.transactionType === "expense" && c.usageScope === "personal"
  );
  const expenseBusiness = systemCategories.filter(
    (c) => c.transactionType === "expense" && c.usageScope === "business"
  );
  const expenseBoth = systemCategories.filter(
    (c) => c.transactionType === "expense" && c.usageScope === "both"
  );

  const renderCategoryBadges = (categories: Category[]) =>
    categories.map((category) => (
      <Badge key={category.id} variant="secondary">
        <Tag className="h-3 w-3 mr-1" />
        {category.name}
      </Badge>
    ));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Financial Categories</h2>
          <p className="text-sm text-muted-foreground">
            System categories organized by income/expense and usage type
          </p>
        </div>
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
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
                Add a new category for organizing your finances
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Category Name</label>
              <Input
                  placeholder="e.g., Gym Membership"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Transaction Type</label>
                <Select
                  value={newCategoryTransactionType}
                  onValueChange={(v) =>
                    setNewCategoryTransactionType(v as "income" | "expense")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Usage Scope</label>
                <Select
                  value={newCategoryUsageScope}
                  onValueChange={(v) =>
                    setNewCategoryUsageScope(
                      v as "personal" | "business" | "both"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Personal & Business</SelectItem>
                    <SelectItem value="personal">Personal Only</SelectItem>
                    <SelectItem value="business">Business Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Description (Optional)
                </label>
                <Textarea
                  placeholder="Add a description for this category"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  rows={3}
              />
              </div>
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

      <Accordion type="multiple" defaultValue={["income", "expense"]} className="w-full">
        {/* Income Categories */}
        <AccordionItem value="income">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-semibold">Income Categories</span>
              <Badge variant="outline" className="ml-2">
                {incomePersonal.length + incomeBusiness.length + incomeBoth.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {incomePersonal.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Personal
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {renderCategoryBadges(incomePersonal)}
                  </div>
                </div>
              )}
              
              {incomeBusiness.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Business
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {renderCategoryBadges(incomeBusiness)}
                  </div>
                </div>
              )}
              
              {incomeBoth.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Personal & Business
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {renderCategoryBadges(incomeBoth)}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Expense Categories */}
        <AccordionItem value="expense">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="font-semibold">Expense Categories</span>
              <Badge variant="outline" className="ml-2">
                {expensePersonal.length + expenseBusiness.length + expenseBoth.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {expensePersonal.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Personal
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {renderCategoryBadges(expensePersonal)}
                  </div>
                </div>
              )}
              
              {expenseBusiness.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Business
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {renderCategoryBadges(expenseBusiness)}
                  </div>
                </div>
              )}
              
              {expenseBoth.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Personal & Business
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {renderCategoryBadges(expenseBoth)}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Custom Categories */}
        {userCategories.length > 0 && (
          <AccordionItem value="custom">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span className="font-semibold">Your Custom Categories</span>
                <Badge variant="outline" className="ml-2">
                  {userCategories.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2 pt-2">
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
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </Card>
  );
}
