"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Pie, PieChart } from "recharts";
import type { CategoryBreakdown } from "@/app/actions/analytics";
import { ExpandableChartCard } from "./expandable-chart-card";

interface CategoryPieChartProps {
  data: CategoryBreakdown[];
  currency?: string;
}

export function CategoryPieChart({
  data,
  currency = "USD",
}: CategoryPieChartProps) {
  // Generate chart config from data
  const chartConfig: ChartConfig = data.reduce((acc, category, index) => {
    acc[category.categoryId] = {
      label: category.categoryName,
      color: `hsl(var(--chart-${(index % 5) + 1}))`,
    };
    return acc;
  }, {} as ChartConfig);

  // Format data for recharts
  const chartData = data.map((category) => ({
    category: category.categoryId,
    categoryName: category.categoryName,
    value: category.totalSpent,
    fill: `var(--color-${category.categoryId})`,
  }));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <ExpandableChartCard title="Category Breakdown">
      {(isExpanded) => (
        <ChartContainer
          config={chartConfig}
          className={
            isExpanded
              ? "mx-auto aspect-square max-h-[500px]"
              : "mx-auto aspect-square max-h-[250px]"
          }
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, item) => (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium">
                        {item.payload.categoryName}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(value as number)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="category"
              innerRadius={isExpanded ? 80 : 50}
              strokeWidth={5}
            />
            {isExpanded && (
              <ChartLegend
                content={<ChartLegendContent nameKey="category" />}
                className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            )}
          </PieChart>
        </ChartContainer>
      )}
    </ExpandableChartCard>
  );
}

