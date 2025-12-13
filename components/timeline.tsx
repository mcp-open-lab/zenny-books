"use client";

import { useState, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal, X, ChevronRight, Loader2 } from "lucide-react";
import { groupItemsByMonth } from "@/lib/utils/timeline";
import { RECEIPT_STATUSES } from "@/lib/consts";
import Link from "next/link";
import type { TimelineItem, TimelineFilters } from "@/lib/api/timeline";
import {
  fetchTimelineItems,
  getTimelineMerchants,
  getTimelineBusinesses,
} from "@/lib/modules/timeline/actions";
import type { categories as categoriesSchema, businesses as businessesSchema } from "@/lib/db/schema";
import { TimelineTable } from "./timeline/timeline-table";

type UserSettings = {
  visibleFields?: Record<string, boolean> | null;
  requiredFields?: Record<string, boolean> | null;
  country?: string | null;
  usageType?: string | null;
  defaultValues?: {
    isBusinessExpense?: boolean | null;
    businessPurpose?: string | null;
    paymentMethod?: "cash" | "card" | "check" | "other" | null;
  } | null;
};

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

type TimelineProps = {
  initialItems: TimelineItem[];
  userSettings?: UserSettings | null;
  categories: Category[];
  merchants: string[];
  businesses: Business[];
};

const statuses = RECEIPT_STATUSES;

export function Timeline({ initialItems, userSettings, categories, merchants, businesses }: TimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [filterOpen, setFilterOpen] = useState(false);

  // Filter State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");

  // Group items for display
  const filteredGroups = useMemo(() => groupItemsByMonth(items), [items]);

  const handleItemUpdated = (
    id: string,
    patch: Partial<
      Pick<TimelineItem, "categoryId" | "category" | "businessId" | "businessName">
    >
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  };

  const buildFilters = (): TimelineFilters => ({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: documentTypeFilter !== "all" ? documentTypeFilter : undefined,
    businessFilter: businessFilter !== "all" ? businessFilter : undefined,
    transactionType: transactionTypeFilter !== "all" ? transactionTypeFilter : undefined,
    merchant: merchantFilter !== "all" ? merchantFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    amountMin: amountMin ? parseFloat(amountMin) : undefined,
    amountMax: amountMax ? parseFloat(amountMax) : undefined,
  });

  const handleLoadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const filters = buildFilters();

      const result = await fetchTimelineItems({
        page: nextPage,
        limit: 20,
        filters,
      });

      if (result.items.length > 0) {
        setItems((prev) => [...prev, ...result.items]);
        setPage(nextPage);
      }
      setHasMore(result.hasMore);
    });
  };

  const applyFilters = () => {
    startTransition(async () => {
      const filters = buildFilters();

      const result = await fetchTimelineItems({ page: 1, limit: 20, filters });
      setItems(result.items);
      setHasMore(result.hasMore);
      setPage(1);
      setFilterOpen(false);
    });
  };

  // Debounce search
  const handleSearch = (value: string) => {
    setSearch(value);
    // Could add debounce here, but for now let's require "Enter" or blur or just effect?
    // Ideally search triggers filter apply.
  };

  // Trigger search on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyFilters();
    }
  };

  const hasActiveFilters = 
    categoryFilter !== "all" || 
    statusFilter !== "all" || 
    documentTypeFilter !== "all" ||
    businessFilter !== "all" ||
    transactionTypeFilter !== "all" ||
    merchantFilter !== "all" ||
    dateFrom !== undefined ||
    dateTo !== undefined ||
    amountMin !== "" ||
    amountMax !== "" ||
    search !== "";

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setDocumentTypeFilter("all");
    setBusinessFilter("all");
    setTransactionTypeFilter("all");
    setMerchantFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setAmountMin("");
    setAmountMax("");
    // We need to trigger fetch with empty filters
    // Ideally call applyFilters() but state updates are async.
    startTransition(async () => {
      const result = await fetchTimelineItems({ page: 1, limit: 20, filters: {} });
      setItems(result.items);
      setHasMore(result.hasMore);
      setPage(1);
      setFilterOpen(false);
    });
  };

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="mb-4 flex gap-2 items-center sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search items... (Press Enter)"
            className="w-full pr-10"
          />
        </div>
        
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[70vh] rounded-t-[20px] flex flex-col"
          >
            <SheetHeader className="flex-shrink-0">
              <SheetTitle>Filter Timeline</SheetTitle>
              <SheetDescription className="sr-only">
                Filter your timeline items
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6 flex-1 overflow-y-auto">
              {/* Transaction Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Transaction Type
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={transactionTypeFilter}
                  onChange={(e) => setTransactionTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              {/* Business Context Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Business Context
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={businessFilter}
                  onChange={(e) => setBusinessFilter(e.target.value)}
                >
                  <option value="all">All Transactions</option>
                  <option value="personal">Personal Only</option>
                  <option value="business">Business Only</option>
                  {businesses.map((biz) => (
                    <option key={biz.id} value={biz.id}>
                      {biz.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Document Type
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={documentTypeFilter}
                  onChange={(e) => setDocumentTypeFilter(e.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="receipt">Receipts</option>
                  <option value="transaction">Bank Statements</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Category
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Merchant Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Merchant
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={merchantFilter}
                  onChange={(e) => setMerchantFilter(e.target.value)}
                >
                  <option value="all">All merchants</option>
                  {merchants.map((merchant) => (
                    <option key={merchant} value={merchant}>
                      {merchant}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {statuses.map((status: string) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <div className="space-y-2">
                  <Input
                    type="date"
                    placeholder="From date"
                    value={dateFrom ? dateFrom.toISOString().split('T')[0] : ""}
                    onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-full"
                  />
                  <Input
                    type="date"
                    placeholder="To date"
                    value={dateTo ? dateTo.toISOString().split('T')[0] : ""}
                    onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Amount Range Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Amount Range</label>
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Min amount"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="w-full"
                  />
                  <Input
                    type="number"
                    placeholder="Max amount"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
                <Button className="flex-1" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {/* Badges would go here, but for simplicity skipping detailed badges logic since reset covers it */}
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-6 text-xs">
            Clear all filters <X className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Timeline View */}
      <div className="space-y-8 pb-24">
        {items.length === 0 && !isPending && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No items match your filters.</p>
            <Button variant="link" onClick={resetFilters}>
              Clear all filters
            </Button>
          </div>
        )}

        {filteredGroups.map((group) => (
          <div key={group.monthKey} className="relative">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 sticky top-14 bg-background/95 backdrop-blur py-2 z-0 px-1">
              {group.monthLabel}
            </h3>
            {/* Mobile: Compact List View */}
            <div className="space-y-2.5 md:hidden pl-4 border-l-2 border-muted ml-2">
              {group.items.map((item) => {
                const href =
                  item.type === "transaction"
                    ? `/app/transactions/${item.id}`
                    : `/app/receipts/${item.id}`;
                const amount = parseFloat(item.amount);
                const isIncome = item.type === "transaction" ? amount >= 0 : false;

                return (
                  <Link key={item.id} href={href}>
                    <Card className="p-3 flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors border-none shadow-sm relative -ml-[19px] group">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary border-2 border-background"></div>
                      <div className="flex-1 ml-3 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.merchantName || "Unknown"}
                        </p>
                        <div className="flex gap-1.5 text-[11px] text-muted-foreground mt-1">
                          <span>
                            {item.date
                              ? new Date(item.date).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "No Date"}
                          </span>
                          {item.category && (
                            <>
                              <span>•</span>
                              <span className="truncate">{item.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`font-semibold text-sm ${isIncome ? "text-green-600" : "text-red-600"}`}>
                          {isIncome ? "+" : "-"}{item.currency || "$"}{Math.abs(amount).toFixed(2)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-1 shrink-0" />
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block">
              <TimelineTable
                items={group.items}
                categories={categories}
                businesses={businesses}
                onItemUpdated={handleItemUpdated}
              />
            </div>
          </div>
        ))}

        {/* Load More / Loading State */}
        <div className="flex justify-center py-4">
          {isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : hasMore ? (
            <Button variant="outline" onClick={handleLoadMore}>
              Load More
            </Button>
          ) : items.length > 0 ? (
            <p className="text-xs text-muted-foreground">End of timeline</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
