import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Check, Edit2, MoreVertical, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { categories } from "@/lib/db/schema";
import type { MerchantStats } from "@/lib/categorization/repositories/transaction-repository";

type Category = typeof categories.$inferSelect;

type MerchantHistorySectionProps = {
  categories: Category[];
  merchantStats: MerchantStats[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  businesses?: { id: string; name: string }[]; // Optional list of user businesses
  isPending: boolean;
  newMerchantName: string;
  setNewMerchantName: (name: string) => void;
  newMerchantCategoryId: string;
  setNewMerchantCategoryId: (id: string) => void;
  newMerchantDisplayName: string;
  setNewMerchantDisplayName: (name: string) => void;
  newMerchantBusinessId: string | undefined;
  setNewMerchantBusinessId: (id: string | undefined) => void;
  merchantDialogOpen: boolean;
  setMerchantDialogOpen: (open: boolean) => void;
  editMerchantDialogOpen: boolean;
  setEditMerchantDialogOpen: (open: boolean) => void;
  editingMerchant: MerchantStats | null;
  setEditingMerchant: (merchant: MerchantStats | null) => void;
  handleCreateMerchantRule: () => void;
  handleQuickCreateRule: (merchantName: string, categoryId: string) => void;
  handleEditMerchantRule: (merchant: MerchantStats) => void;
  handleUpdateMerchantRule: () => void;
  handleDeleteMerchantRule: (ruleId: string) => void;
};

export function MerchantHistorySection({
  categories,
  merchantStats,
  totalCount,
  totalPages,
  currentPage,
  businesses = [],
  isPending,
  newMerchantName,
  setNewMerchantName,
  newMerchantCategoryId,
  setNewMerchantCategoryId,
  newMerchantDisplayName,
  setNewMerchantDisplayName,
  newMerchantBusinessId,
  setNewMerchantBusinessId,
  merchantDialogOpen,
  setMerchantDialogOpen,
  editMerchantDialogOpen,
  setEditMerchantDialogOpen,
  editingMerchant,
  setEditingMerchant,
  handleCreateMerchantRule,
  handleQuickCreateRule,
  handleEditMerchantRule,
  handleUpdateMerchantRule,
  handleDeleteMerchantRule,
}: MerchantHistorySectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };
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
                <label className="text-sm font-medium">
                  Business (Optional)
                </label>
                <Select
                  value={newMerchantBusinessId || "none"}
                  onValueChange={(value) =>
                    setNewMerchantBusinessId(value === "none" ? undefined : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Personal)</SelectItem>
                    {businesses.map((business) => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Assign this merchant to a specific business. If not set, transactions
                  will default to personal.
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

        {/* Edit Merchant Rule Dialog */}
        <Dialog
          open={editMerchantDialogOpen}
          onOpenChange={setEditMerchantDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Merchant Rule</DialogTitle>
              <DialogDescription>
                Update the category or display name for this merchant
              </DialogDescription>
            </DialogHeader>
            {editingMerchant && (
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Merchant Name</label>
                  <Input
                    value={editingMerchant.merchantName}
                    disabled
                    className="bg-muted"
                  />
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
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Business (Optional)
                  </label>
                  <Select
                    value={newMerchantBusinessId || "none"}
                    onValueChange={(value) =>
                      setNewMerchantBusinessId(value === "none" ? undefined : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Personal)</SelectItem>
                      {businesses.map((business) => (
                        <SelectItem key={business.id} value={business.id}>
                          {business.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign this merchant to a specific business. If not set, transactions
                    will default to personal.
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
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditMerchantDialogOpen(false);
                  setEditingMerchant(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateMerchantRule}
                disabled={isPending || !newMerchantCategoryId}
              >
                Update Rule
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
                <div className="col-span-3 overflow-hidden">
                  <Link
                    href={`/app/merchants/${encodeURIComponent(stat.merchantName)}`}
                    className="font-medium text-sm truncate block hover:text-primary underline-offset-4 hover:underline"
                    title={stat.merchantName}
                  >
                    {stat.merchantName}
                  </Link>
                </div>
                <div className="col-span-3 overflow-hidden">
                  {stat.mostCommonCategoryName ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs truncate max-w-[140px]" title={stat.mostCommonCategoryName}>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={isPending}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {stat.hasRule ? (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleEditMerchantRule(stat)}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit Rule
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              stat.ruleId && handleDeleteMerchantRule(stat.ruleId)
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Rule
                          </DropdownMenuItem>
                        </>
                      ) : stat.mostCommonCategoryId ? (
                        <DropdownMenuItem
                          onClick={() =>
                            handleQuickCreateRule(
                              stat.merchantName,
                              stat.mostCommonCategoryId!
                            )
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Rule
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled>
                          No category available
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t px-3">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * 25 + 1}-{Math.min(currentPage * 25, totalCount)} of {totalCount}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-9"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

