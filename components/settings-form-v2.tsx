"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { saveUserSettings } from "@/app/actions/user-settings";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SettingsSchema, type SettingsFormValues } from "@/lib/schemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  US_STATES,
  CANADIAN_PROVINCES,
  getDefaultVisibleFields,
  getDefaultRequiredFields,
  syncRequiredWithVisible,
  PAYMENT_METHODS,
  getDefaultDefaultValues,
} from "@/lib/consts";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type SettingsFormProps = {
  initialSettings: {
    userId: string;
    usageType: string | null;
    country: string | null;
    province: string | null;
    currency: string | null;
    visibleFields: Record<string, boolean> | null;
    requiredFields: Record<string, boolean> | null;
    defaultValues?: {
      isBusinessExpense?: boolean | null;
      businessPurpose?: string | null;
      paymentMethod?: "cash" | "card" | "check" | "other" | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export function SettingsFormV2({ initialSettings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();

  const initialUsageType =
    (initialSettings.usageType as "personal" | "business" | "mixed") ||
    "personal";

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: {
      usageType: initialUsageType,
      country: (initialSettings.country as "US" | "CA") || "US",
      province: initialSettings.province || "",
      currency: initialSettings.currency || "USD",
      visibleFields:
        initialSettings.visibleFields ||
        getDefaultVisibleFields(initialUsageType) ||
        {},
      requiredFields:
        initialSettings.requiredFields ||
        getDefaultRequiredFields(initialUsageType) ||
        {},
      defaultValues: initialSettings.defaultValues || getDefaultDefaultValues(),
    },
  });

  const usageType = form.watch("usageType");
  const country = form.watch("country");
  const visibleFields = form.watch("visibleFields");

  const onSubmit = (data: SettingsFormValues) => {
    startTransition(async () => {
      try {
        const finalRequired = syncRequiredWithVisible(
          data.visibleFields,
          data.requiredFields
        );
        await saveUserSettings({
          ...data,
          requiredFields: finalRequired,
        });
        toast.success("Settings saved!");
      } catch (error) {
        console.error("Failed to save settings:", error);
        toast.error(
          `Failed to save settings: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* General Settings */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">General Settings</h2>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="usageType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usage Type</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      const newType = val as "personal" | "business" | "mixed";
                      const newVisible = getDefaultVisibleFields(newType);
                      const newRequired = getDefaultRequiredFields(newType);
                      const syncedRequired = syncRequiredWithVisible(
                        newVisible,
                        newRequired
                      );

                      form.setValue("visibleFields", {
                        ...form.getValues("visibleFields"),
                        ...newVisible,
                      });
                      form.setValue("requiredFields", {
                        ...form.getValues("requiredFields"),
                        ...syncedRequired,
                      });
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="mixed">Both</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("province", "");
                      form.setValue("currency", value === "CA" ? "CAD" : "USD");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {country && (
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {country === "US" ? "State" : "Province"}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={`Select ${
                              country === "US" ? "state" : "province"
                            }`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(country === "US"
                          ? US_STATES
                          : CANADIAN_PROVINCES
                        ).map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>

        {/* Document Type Settings */}
        <Card className="p-6">
          <Accordion type="single" collapsible className="w-full">
            {/* Receipt Settings */}
            <AccordionItem value="receipts">
              <AccordionTrigger className="text-lg font-semibold">
                Receipt Settings
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Configure which fields to show and require when processing receipts
                </p>
                
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Visible Fields</h3>
                  {[
                    { name: "taxAmount", label: "Tax Amount" },
                    { name: "category", label: "Category" },
                    { name: "tipAmount", label: "Tip Amount" },
                    { name: "discountAmount", label: "Discount Amount" },
                    { name: "description", label: "Description" },
                    { name: "paymentMethod", label: "Payment Method" },
                  ].map((item) => (
                    <FormField
                      key={item.name}
                      control={form.control}
                      name={`visibleFields.${item.name}`}
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg p-3 shadow-sm border">
                          <FormLabel>{item.label}</FormLabel>
                          <FormControl>
                            <Switch
                              checked={Boolean(field.value)}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (!checked) {
                                  form.setValue(
                                    `requiredFields.${item.name}`,
                                    false
                                  );
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}

                  {(usageType === "business" || usageType === "mixed") && (
                    <>
                      <FormField
                        control={form.control}
                        name="visibleFields.businessPurpose"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg p-3 shadow-sm border">
                            <FormLabel>Business Purpose</FormLabel>
                            <FormControl>
                              <Switch
                                checked={Boolean(field.value)}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (!checked) {
                                    form.setValue(
                                      "requiredFields.businessPurpose",
                                      false
                                    );
                                  }
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="visibleFields.isBusinessExpense"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg p-3 shadow-sm border">
                            <FormLabel>Is Business Expense</FormLabel>
                            <FormControl>
                              <Switch
                                checked={Boolean(field.value)}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (!checked) {
                                    form.setValue(
                                      "requiredFields.isBusinessExpense",
                                      false
                                    );
                                  }
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <div className="space-y-3 pt-4">
                  <h3 className="text-sm font-medium">Required Fields</h3>
                  <p className="text-xs text-muted-foreground">
                    Only visible fields can be marked as required
                  </p>
                  {[
                    { name: "category", label: "Category" },
                    { name: "paymentMethod", label: "Payment Method" },
                  ].filter((item) => visibleFields[item.name]).map((item) => (
                    <FormField
                      key={item.name}
                      control={form.control}
                      name={`requiredFields.${item.name}`}
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg p-3 shadow-sm border">
                          <FormLabel>{item.label}</FormLabel>
                          <FormControl>
                            <Switch
                              checked={Boolean(field.value)}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Bank Statement Settings */}
            <AccordionItem value="bank-statements">
              <AccordionTrigger className="text-lg font-semibold">
                Bank Statement Settings
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Bank statement transactions are automatically categorized using AI and rules
                </p>
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm">
                    Advanced categorization settings and rules can be managed in the Categories page
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        {/* Link to Categories Management */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Categories & Rules</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Manage expense categories and auto-categorization rules
              </p>
            </div>
            <Link href="/app/settings/categories">
              <Button variant="outline" type="button">
                Manage
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

