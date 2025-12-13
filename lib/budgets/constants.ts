export const EXCLUDED_BUDGET_CATEGORIES = ["Credit Card Payment"] as const;

export const BUDGET_STATUS_CONFIG = {
  under: {
    bar: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
    border: "",
    bg: "",
  },
  caution: {
    bar: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-900",
    bg: "bg-orange-50/50 dark:bg-orange-950/20",
  },
  over: {
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-900",
    bg: "bg-red-50/50 dark:bg-red-950/20",
  },
  unbudgeted: {
    bar: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    border: "",
    bg: "",
  },
} as const;

