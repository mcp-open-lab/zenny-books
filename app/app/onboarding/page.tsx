"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { saveUserSettings } from "@/app/actions/user-settings";
import { devLogger } from "@/lib/dev-logger";
import { logger } from "@/lib/logger";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OnboardingSchema, type OnboardingFormValues } from "@/lib/schemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { US_STATES, CANADIAN_PROVINCES } from "@/lib/consts";

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(OnboardingSchema),
    defaultValues: {
      usageType: "personal",
      country: "US",
      province: "",
    },
  });

  const country = form.watch("country");

  const onSubmit = (data: OnboardingFormValues) => {
    startTransition(async () => {
      try {
        await saveUserSettings({
          ...data,
          currency: data.country === "CA" ? "CAD" : "USD",
        });
        toast.success("Settings saved!");
        router.push("/app");
        router.refresh();
      } catch (error) {
        // Production logging - errors only
        logger.error("Failed to save settings", error, {
          action: "saveUserSettings",
          statusCode: 500,
        });
        // Dev logging - full context for debugging
        devLogger.error("Failed to save settings", error, {
          action: "saveUserSettings",
        });
        toast.error("Failed to save settings");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-white">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Welcome to Turbo Invoice</h1>
          <p className="text-muted-foreground">
            Let's personalize your experience
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="usageType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How do you use Turbo Invoice?</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <FormLabel>Where are you located?</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("province", "");
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
                    <FormLabel>{country === "US" ? "State" : "Province"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${country === "US" ? "state" : "province"}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(country === "US" ? US_STATES : CANADIAN_PROVINCES).map(
                          (code) => (
                            <SelectItem key={code} value={code}>
                              {code}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Get Started"}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
