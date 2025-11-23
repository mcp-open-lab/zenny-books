import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
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
import { Plus, Check, Edit2 } from "lucide-react";
import type { categories } from "@/lib/db/schema";
import type { MerchantStats } from "@/lib/categorization/repositories/transaction-repository";

type Category = typeof categories.$inferSelect;

type MerchantHistorySectionProps = {
  categories: Category[];
  merchantStats: MerchantStats[];
  isPending: boolean;
  newMerchantName: string;
  setNewMerchantName: (name: string) => void;
  newMerchantCategoryId: string;
  setNewMerchantCategoryId: (id: string) => void;
  newMerchantDisplayName: string;
  setNewMerchantDisplayName: (name: string) => void;
  merchantDialogOpen: boolean;
  setMerchantDialogOpen: (open: boolean) => void;
  handleCreateMerchantRule: () => void;
  handleQuickCreateRule: (merchantName: string, categoryId: string) => void;
};

export function MerchantHistorySection({
  categories,
  merchantStats,
  isPending,
  newMerchantName,
  setNewMerchantName,
  newMerchantCategoryId,
  setNewMerchantCategoryId,
  newMerchantDisplayName,
  setNewMerchantDisplayName,
  merchantDialogOpen,
  setMerchantDialogOpen,
  handleCreateMerchantRule,
  handleQuickCreateRule,
}: MerchantHistorySectionProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Merchant History</h2>
          <p className="text-sm text-muted-foreground">
            Create rules based on your transaction history to automatically
            categorize future transactions
          </p>
        </div>
        <Dialog open={merchantDialogOpen} onOpenChange={setMerchantDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Merchant Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Merchant Rule</DialogTitle>
              <DialogDescription>
                Set a default category for a merchant
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Merchant Name</label>
                <Input
                  placeholder="Enter merchant name (exact match)"
                  value={newMerchantName}
                  onChange={(e) => setNewMerchantName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must match exactly as it appears in transactions
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Display Name (Optional)
                </label>
                <Input
                  placeholder="Friendly name for this merchant"
                  value={newMerchantDisplayName}
                  onChange={(e) => setNewMerchantDisplayName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For clarity in your rules list (e.g., &quot;Starbucks&quot; instead of
                  &quot;STARBUCKS STORE #1234&quot;)
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={newMerchantCategoryId}
                  onValueChange={setNewMerchantCategoryId}
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
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateMerchantRule}
                disabled={
                  isPending || !newMerchantCategoryId || !newMerchantName.trim()
                }
              >
                Create Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {merchantStats.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>
            No merchant history yet. Start categorizing transactions to see
            patterns!
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              <div className="col-span-3">Merchant</div>
              <div className="col-span-3">Most Common Category</div>
              <div className="col-span-2 text-center">Transactions</div>
              <div className="col-span-2 text-center">Last Used</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {merchantStats.map((stat) => (
              <div
                key={stat.merchantName}
                className="grid grid-cols-12 gap-3 items-center p-3 border-b hover:bg-muted/50 transition-colors"
              >
                <div className="col-span-3">
                  <Link
                    href={`/app/merchants/${encodeURIComponent(stat.merchantName)}`}
                    className="font-medium text-sm truncate hover:text-primary underline-offset-4 hover:underline"
                    title={stat.merchantName}
                  >
                    {stat.merchantName}
                  </Link>
                </div>
                <div className="col-span-3">
                  {stat.mostCommonCategoryName ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {stat.mostCommonCategoryName}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        ({stat.categoryUsageCount}x)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Uncategorized
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-center text-sm">
                  {stat.transactionCount}
                </div>
                <div className="col-span-2 text-center text-xs text-muted-foreground">
                  {new Date(stat.lastUsedDate).toLocaleDateString()}
                </div>
                <div className="col-span-2 flex justify-end">
                  {stat.hasRule ? (
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      <Check className="h-3 w-3 mr-1" />
                      Rule Set
                    </Badge>
                  ) : stat.mostCommonCategoryId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleQuickCreateRule(
                          stat.merchantName,
                          stat.mostCommonCategoryId!
                        )
                      }
                      disabled={isPending}
                      className="h-8 px-3 text-xs whitespace-nowrap"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create Rule
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

