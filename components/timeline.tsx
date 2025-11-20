"use client";

import { useState, useTransition, useEffect } from "react";
import type { receipts } from "@/lib/db/schema";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateReceipt } from "@/app/actions/update-receipt";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import type { TimelineGroup, SortBy } from "@/lib/utils/timeline";
import { groupItemsByMonth } from "@/lib/utils/timeline";

type Receipt = typeof receipts.$inferSelect;

type TimelineProps = {
  receipts: Receipt[];
  timelineGroups: TimelineGroup[];
};

const categories = ["Food", "Transport", "Utilities", "Supplies", "Other"];
const statuses = ["needs_review", "approved"];

export function Timeline({
  receipts,
  timelineGroups: initialGroups,
}: TimelineProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [formState, setFormState] = useState({
    merchantName: "",
    date: "",
    totalAmount: "",
    category: "",
    status: "needs_review",
  });
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("receipt_date");

  // Re-group items when sort changes
  const timelineGroups = groupItemsByMonth(receipts, sortBy);

  const availableCategories = Array.from(
    new Set(
      receipts.map((r) => r.category).filter((c): c is string => Boolean(c))
    )
  );

  const availableStatuses = Array.from(
    new Set(
      receipts.map((r) => r.status).filter((s): s is string => Boolean(s))
    )
  );

  // Filter timeline groups client-side (search and filters)
  const filteredGroups = timelineGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((receipt) => {
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch = normalizedSearch
          ? (receipt.merchantName || "")
              .toLowerCase()
              .includes(normalizedSearch) ||
            (receipt.fileName || "").toLowerCase().includes(normalizedSearch)
          : true;

        const matchesCategory =
          categoryFilter === "all" || receipt.category === categoryFilter;

        const matchesStatus =
          statusFilter === "all" || receipt.status === statusFilter;

        return matchesSearch && matchesCategory && matchesStatus;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const totalFilteredCount = filteredGroups.reduce(
    (sum, group) => sum + group.items.length,
    0
  );

  useEffect(() => {
    if (selected) {
      setFormState({
        merchantName: selected.merchantName ?? "",
        date: selected.date
          ? new Date(selected.date).toISOString().split("T")[0]
          : "",
        totalAmount: selected.totalAmount ?? "",
        category: selected.category ?? "",
        status: selected.status ?? "needs_review",
      });
    }
  }, [selected]);

  const handleSave = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await updateReceipt({
          id: selected.id,
          merchantName: formState.merchantName || null,
          date: formState.date || null,
          totalAmount: formState.totalAmount || null,
          category: formState.category || null,
          status: formState.status,
        });
        toast.success("Receipt updated");
        setOpen(false);
      } catch (error) {
        console.error("Update failed", error);
        toast.error("Failed to update receipt");
      }
    });
  };

  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="mb-4 flex gap-2 items-center sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipts..."
            className="w-full pr-10"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="border rounded-md px-3 py-2 text-sm bg-background shrink-0 hidden sm:block"
          aria-label="Sort timeline by"
        >
          <option value="receipt_date">Receipt Date</option>
          <option value="created_at">Created Date</option>
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
          <SheetContent side="bottom" className="h-[70vh] rounded-t-[20px]">
            <SheetHeader>
              <SheetTitle>Filter Receipts</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Sort Timeline By
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
                  ).map((category) => (
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
                  ).map((status) => (
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
                    setCategoryFilter("all");
                    setStatusFilter("all");
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
            <p>No receipts match your filters.</p>
            <Button
              variant="link"
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
                setStatusFilter("all");
              }}
            >
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
              {group.items.map((receipt) => (
                <Card
                  key={receipt.id}
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors border-none shadow-sm relative -ml-[21px]"
                  onClick={() => {
                    setSelected(receipt);
                    setOpen(true);
                  }}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background"></div>
                  <div className="flex-1 ml-4">
                    <p className="font-semibold text-sm md:text-base">
                      {receipt.merchantName || "Unknown Vendor"}
                    </p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>
                        {receipt.date
                          ? new Date(receipt.date).toLocaleDateString(
                              undefined,
                              { day: "numeric", weekday: "short" }
                            )
                          : "No Date"}
                      </span>
                      {receipt.category && (
                        <>
                          <span>•</span>
                          <span>{receipt.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm md:text-base">
                      -${receipt.totalAmount || "0.00"}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        receipt.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {receipt.status === "needs_review" ? "Review" : "Done"}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setSelected(null);
            setImageExpanded(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] w-[calc(100vw-2rem)] md:w-full overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 flex-shrink-0">
            <DialogTitle>
              {(() => {
                if (!selected) return "Edit Item";
                if (selected.type === "invoice") {
                  return `Edit Invoice (${
                    selected.direction === "in" ? "Received" : "Sent"
                  })`;
                }
                return "Edit Receipt";
              })()}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 md:pb-6">
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                <div className="order-2 md:order-1">
                  <div
                    className="relative w-full h-48 md:h-80 rounded-lg overflow-hidden border bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImageExpanded(true)}
                  >
                    <Image
                      src={selected.imageUrl}
                      alt={selected.merchantName ?? "Receipt image"}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain"
                      priority
                      unoptimized={selected.imageUrl.includes(".ufs.sh")}
                      onError={(e) => {
                        console.error("Image load error:", selected.imageUrl);
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 break-all">
                    {selected.fileName || "Uploaded image"}
                  </p>
                </div>
                <div className="space-y-3 md:space-y-4 order-1 md:order-2">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Merchant
                    </label>
                    <Input
                      value={formState.merchantName}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          merchantName: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Date
                    </label>
                    <Input
                      type="date"
                      value={formState.date}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Total Amount
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formState.totalAmount}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          totalAmount: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Category
                    </label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={formState.category}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Status
                    </label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={formState.status}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isPending}
                      className="w-full sm:w-auto"
                    >
                      {isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expanded Image Overlay */}
      {imageExpanded && selected && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={(e) => {
            // Only close if clicking the background, not the image itself
            if (e.target === e.currentTarget) {
              setImageExpanded(false);
            }
          }}
        >
          <div
            className="relative w-full h-full max-w-7xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selected.imageUrl}
              alt={selected.merchantName ?? "Receipt image"}
              fill
              sizes="100vw"
              className="object-contain"
              priority
              unoptimized={selected.imageUrl.includes(".ufs.sh")}
              onError={(e) => {
                console.error("Image load error:", selected.imageUrl);
              }}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setImageExpanded(false);
            }}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 z-10"
            aria-label="Close expanded image"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}
