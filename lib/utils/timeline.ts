import type { TimelineItem } from "@/lib/api/timeline";

export type TimelineGroup = {
  monthKey: string;
  monthLabel: string;
  items: TimelineItem[];
};

export type SortBy = "receipt_date" | "created_at";

export function groupItemsByMonth(
  items: TimelineItem[]
): TimelineGroup[] {
  const groups = items.reduce((acc, item) => {
    // TimelineItem already normalized 'date' to be the transaction date
    // We don't have 'createdAt' on TimelineItem type yet, let's assume 'date' is the primary sort
    const date = item.date ? new Date(item.date) : new Date();
    
    const monthKey = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });

    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(item);
    return acc;
  }, {} as Record<string, TimelineItem[]>);

  return Object.entries(groups)
    .map(([monthKey, groupItems]) => ({
      monthKey,
      monthLabel: monthKey,
      items: groupItems.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date();
        const dateB = b.date ? new Date(b.date) : new Date();
        return dateB.getTime() - dateA.getTime();
      }),
    }))
    .sort((a, b) => {
      const dateA = new Date(a.monthKey);
      const dateB = new Date(b.monthKey);
      return dateB.getTime() - dateA.getTime();
    });
}
