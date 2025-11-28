"use client";

import { useState, useMemo, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Building2, User } from "lucide-react";
import type { categories as categoriesSchema, businesses as businessesSchema } from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface TransactionCategorizationProps {
  form: UseFormReturn<any>;
  categories: Category[];
  businesses: Business[];
  transactionType: "income" | "expense";
  requiredFields?: Record<string, boolean>;
  onCreateRule?: () => void;
}

export function TransactionCategorization({
  form,
  categories,
  businesses,
  transactionType,
  requiredFields = {},
  onCreateRule,
}: TransactionCategorizationProps) {
  // Determine if this is a business transaction based on businessId
  const currentBusinessId = form.watch("businessId");
  const [contextMode, setContextMode] = useState<"personal" | "business">(
    form.getValues("businessId") ? "business" : "personal"
  );

  // Sync contextMode when businessId changes
  useEffect(() => {
    if (currentBusinessId) {
      setContextMode("business");
    } else if (!currentBusinessId && contextMode === "business" && businesses.length === 0) {
      // Only switch to personal if no businesses exist
      setContextMode("personal");
    }
  }, [currentBusinessId, businesses.length, contextMode]);

  // Get current categoryId from form
  const currentCategoryId = form.watch("categoryId");

  // Filter categories based on transaction type and context mode
  // Always include the current category even if it doesn't match filters
  const filteredCategories = useMemo(() => {
    const filtered = categories.filter((cat) => {
      // Always include the current category
      if (currentCategoryId && cat.id === currentCategoryId) {
        return true;
      }

      // Match transaction type
      if (cat.transactionType !== transactionType) {
        return false;
      }

      // Match usage scope based on context mode
      if (contextMode === "personal") {
        return cat.usageScope === "personal" || cat.usageScope === "both";
      } else {
        return cat.usageScope === "business" || cat.usageScope === "both";
      }
    });
    return filtered;
  }, [categories, transactionType, contextMode, currentCategoryId]);

  // Handle context mode change
  const handleContextChange = (mode: "personal" | "business") => {
    setContextMode(mode);
    
    if (mode === "personal") {
      // Clear business assignment
      form.setValue("businessId", null);
    } else if (businesses.length === 1) {
      // Auto-select if only one business
      form.setValue("businessId", businesses[0].id);
    } else if (businesses.length === 0) {
      // No businesses, stay in personal mode
      setContextMode("personal");
    }
  };

  return (
    <div className="space-y-4">
      {/* Context Switcher */}
      {businesses.length > 0 && (
        <div className="space-y-2">
          <Label>Transaction Context</Label>
          <Tabs value={contextMode} onValueChange={(v) => handleContextChange(v as "personal" | "business")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="business" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Business Selector (only show in business mode with multiple businesses) */}
      {contextMode === "business" && businesses.length > 1 && (
        <FormField
          control={form.control}
          name="businessId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Business
                {requiredFields.businessId && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {businesses.map((business) => (
                    <SelectItem key={business.id} value={business.id}>
                      {business.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Category Selector with Create Rule */}
      <FormField
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>
                Category
                {requiredFields.category && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              {onCreateRule && form.watch("merchantName") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCreateRule}
                  className="h-7 text-xs"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Create Rule
                </Button>
              )}
            </div>
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {filteredCategories.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No {transactionType} categories available for {contextMode} use
                  </div>
                )}
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name} {cat.type === "user" ? "(Custom)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

