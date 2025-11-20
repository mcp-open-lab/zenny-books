"use client";

import { useTransition } from "react";
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
  US_STATES,
  CANADIAN_PROVINCES,
  DEFAULT_REQUIRED_FIELDS,
  RECEIPT_FIELDS,
  getDefaultVisibleFields,
  getDefaultRequiredFields,
  syncRequiredWithVisible,
  PAYMENT_METHODS,
  getDefaultDefaultValues,
} from "@/lib/consts";

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

export function SettingsForm({ initialSettings }: SettingsFormProps) {
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
        // Final sync before saving
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

  const onError = (errors: unknown) => {
    console.error("Form validation errors:", errors);
    const errorObj = errors as Record<string, { message?: string }>;
    const errorFields = Object.keys(errorObj);

    if (errorFields.length > 0) {
      const firstError = errorObj[errorFields[0]];
      const fieldName = errorFields[0]
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      toast.error(firstError?.message || `${fieldName} is required`);
    } else {
      toast.error("Please fix the form errors before saving");
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className="space-y-6"
      >
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Profile</h2>
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
                      // Sync defaults when usage type changes
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
                        <SelectTrigger
                          className={
                            form.formState.errors.province
                              ? "border-destructive"
                              : ""
                          }
                        >
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

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Field Visibility</h2>
          <p className="text-sm text-muted-foreground">
            Choose which fields you want to see and edit when viewing receipts
          </p>
          <div className="space-y-3">
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
                    <div className="space-y-0.5">
                      <FormLabel>{item.label}</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={Boolean(field.value)}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          // If hiding a field, also make it not required
                          if (!checked) {
                            form.setValue(`requiredFields.${item.name}`, false);
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
                      <div className="space-y-0.5">
                        <FormLabel>Business Purpose</FormLabel>
                      </div>
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
                      <div className="space-y-0.5">
                        <FormLabel>Is Business Expense</FormLabel>
                      </div>
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
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Required Fields</h2>
          <p className="text-sm text-muted-foreground">
            Choose which fields must be filled when editing receipts. Critical
            fields like merchant name, date, and total amount are required by
            default.
          </p>
          <div className="space-y-3">
            {RECEIPT_FIELDS.map((field) => {
              // Only show required field toggle if field is visible
              const isCoreField = [
                "merchantName",
                "date",
                "totalAmount",
              ].includes(field.key);
              // Field is visible if it's core OR explicitly set to true in visibleFields
              const isVisible =
                isCoreField || visibleFields[field.key] === true;
              const isBusinessField =
                field.key === "businessPurpose" ||
                field.key === "isBusinessExpense";
              const showForUsageType =
                !isBusinessField ||
                usageType === "business" ||
                usageType === "mixed";

              if (!isVisible || !showForUsageType) {
                return null;
              }

              return (
                <FormField
                  key={field.key}
                  control={form.control}
                  name={`requiredFields.${field.key}`}
                  render={({ field: formField }) => (
                    <FormItem className="flex items-center justify-between rounded-lg p-3 shadow-sm border">
                      <div className="space-y-0.5">
                        <FormLabel>{field.label}</FormLabel>
                        {isCoreField && (
                          <p className="text-xs text-muted-foreground">
                            Always required
                          </p>
                        )}
                      </div>
                      <FormControl>
                        <Switch
                          checked={
                            isCoreField ? true : Boolean(formField.value)
                          }
                          disabled={isCoreField}
                          onCheckedChange={(checked) => {
                            if (isCoreField) {
                              return; // Core fields cannot be toggled
                            }
                            // Auto-disable if field becomes hidden
                            const isVisible =
                              isCoreField || visibleFields[field.key] === true;
                            if (!isVisible && checked) {
                              return; // Can't require hidden field
                            }
                            formField.onChange(checked);
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              );
            })}
          </div>
        </Card>

        {(usageType === "business" || usageType === "mixed") && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Default Values</h2>
            <p className="text-sm text-muted-foreground">
              Set default values that will be automatically filled when creating
              or editing receipts. Leave empty to not use defaults.
            </p>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="defaultValues.isBusinessExpense"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Business Expense</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(
                          value === "none" ? null : value === "true"
                        );
                      }}
                      value={
                        field.value === null || field.value === undefined
                          ? "none"
                          : field.value
                          ? "true"
                          : "false"
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No default" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No default</SelectItem>
                        <SelectItem value="true">
                          Yes (Business Expense)
                        </SelectItem>
                        <SelectItem value="false">
                          No (Personal Expense)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultValues.businessPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Business Purpose</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Client meeting, Office supplies"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultValues.paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Payment Method</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value === "none" ? null : value);
                      }}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No default" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No default</SelectItem>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method.charAt(0).toUpperCase() + method.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </Form>
  );
}
