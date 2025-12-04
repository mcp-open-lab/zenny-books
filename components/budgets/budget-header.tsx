"use client";

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BudgetHeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
}

export function BudgetHeader({
  month,
  onMonthChange,
}: BudgetHeaderProps) {
  const formatMonth = (monthStr: string) => {
    const [year, monthNum] = monthStr.split("-").map(Number);
    const date = new Date(year, monthNum - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const navigateMonth = useCallback((direction: -1 | 1) => {
    const [year, monthNum] = month.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + direction);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    onMonthChange(newMonth);
  }, [month, onMonthChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only navigate if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateMonth(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateMonth(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateMonth]);

  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="text-center">
        <h2 className="text-xl font-semibold">{formatMonth(month)}</h2>
        {!isCurrentMonth && (
          <Button
            variant="link"
            size="sm"
            className="text-xs text-muted-foreground h-auto p-0"
            onClick={() => onMonthChange(new Date().toISOString().slice(0, 7))}
          >
            Go to today
          </Button>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
