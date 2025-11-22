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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Tag } from "lucide-react";
import type { categories } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;

type CategoriesSectionProps = {
  systemCategories: Category[];
  userCategories: Category[];
  isPending: boolean;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
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
  categoryDialogOpen,
  setCategoryDialogOpen,
  handleCreateCategory,
  handleDeleteCategory,
}: CategoriesSectionProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            System categories are provided by default. You can create custom
            categories.
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
            <h3 className="text-sm font-medium mb-2">Your Custom Categories</h3>
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
  );
}
