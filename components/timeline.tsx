"use client";

import { useState } from "react";
import type { receipts } from "@/lib/db/schema";
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
import { SlidersHorizontal, X } from "lucide-react";
import type { TimelineGroup, SortBy } from "@/lib/utils/timeline";
import { useTimelineFilters } from "@/components/use-timeline-filters";
import { EditReceiptDialog } from "@/components/edit-receipt-dialog";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { RECEIPT_CATEGORIES, RECEIPT_STATUSES } from "@/lib/consts";

type Receipt = typeof receipts.$inferSelect;

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

type TimelineProps = {
  receipts: Receipt[];
  timelineGroups: TimelineGroup[];
  userSettings?: UserSettings | null;
};

const categories = RECEIPT_CATEGORIES;
const statuses = RECEIPT_STATUSES;

export function Timeline({ receipts, userSettings }: TimelineProps) {
  const hydrated = useHydrated();
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Use the new hook for filter logic
  const {
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    filteredGroups,
    availableCategories,
    availableStatuses,
    totalFilteredCount,
    activeFilterCount,
    resetFilters,
  } = useTimelineFilters(receipts);

  if (!hydrated) {
    return (
      <div className="space-y-8 pb-24">
        <div className="h-10 bg-muted/20 rounded-md animate-pulse mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-muted/20 rounded-md animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="mb-4 flex gap-2 items-center sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pr-10"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="border rounded-md px-3 py-2 text-sm bg-background shrink-0 hidden sm:block"
          aria-label="Sort by"
        >
          <option value="receipt_date">Sort by Receipt Date</option>
          <option value="created_at">Sort by Created Date</option>
        </select>
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[70vh] rounded-t-[20px] flex flex-col"
          >
            <SheetHeader className="flex-shrink-0">
              <SheetTitle>Filter & Sort</SheetTitle>
              <SheetDescription className="sr-only">
                Filter and sort your timeline items
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6 flex-1 overflow-y-auto">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Sort By
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortBy);
                    setFilterOpen(false);
                  }}
                >
                  <option value="receipt_date">
                    Receipt Date (Transaction Date)
                  </option>
                  <option value="created_at">Created Date (When Added)</option>
                </select>
              </div>
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
                  {(availableCategories.length
                    ? availableCategories
                    : categories
                  ).map((category: string) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {(availableStatuses.length
                    ? availableStatuses
                    : statuses
                  ).map((status: string) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    resetFilters();
                    setFilterOpen(false);
                  }}
                >
                  Clear Filters
                </Button>
              )}
              <Button className="w-full" onClick={() => setFilterOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categoryFilter !== "all" && (
            <div className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {categoryFilter}
              <button
                onClick={() => setCategoryFilter("all")}
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {statusFilter !== "all" && (
            <div className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {statusFilter.replace("_", " ")}
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Timeline View */}
      <div className="space-y-8 pb-24">
        {totalFilteredCount === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No items match your filters.</p>
            <Button variant="link" onClick={() => resetFilters()}>
              Clear all filters
            </Button>
          </div>
        )}

        {filteredGroups.map((group) => (
          <div key={group.monthKey} className="relative">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 sticky top-14 bg-background/95 backdrop-blur py-2 z-0 px-1">
              {group.monthLabel}
            </h3>
            <div className="space-y-3 pl-4 border-l-2 border-muted ml-2">
              {group.items.map((item) => (
                <Card
                  key={item.id}
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors border-none shadow-sm relative -ml-[21px]"
                  onClick={() => {
                    setSelected(item);
                    setOpen(true);
                  }}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background"></div>
                  <div className="flex-1 ml-4">
                    <p className="font-semibold text-sm md:text-base">
                      {item.merchantName || "Unknown Vendor"}
                    </p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>
                        {item.date
                          ? new Date(item.date).toLocaleDateString(undefined, {
                              day: "numeric",
                              weekday: "short",
                            })
                          : "No Date"}
                      </span>
                      {item.category && (
                        <>
                          <span>•</span>
                          <span>{item.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm md:text-base">
                      -${item.totalAmount || "0.00"}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        item.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.status === "needs_review" ? "Review" : "Done"}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <EditReceiptDialog
        open={open}
        onOpenChange={setOpen}
        receipt={selected}
        userSettings={userSettings}
      />
    </>
  );
}
