"use server";

import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { SettingsSchema, OnboardingSchema } from "@/lib/schemas";
import type { SettingsFormValues, OnboardingFormValues } from "@/lib/schemas";
import {
  getDefaultVisibleFields,
  getDefaultRequiredFields,
  syncRequiredWithVisible,
} from "@/lib/consts";
import { createAuthenticatedAction } from "@/lib/safe-action";

export type UsageType = "personal" | "business" | "mixed";
export type Country = "US" | "CA";

export const saveUserSettings = createAuthenticatedAction(
  "saveUserSettings",
  async (userId, data: SettingsFormValues | OnboardingFormValues) => {
    let validated: SettingsFormValues | OnboardingFormValues;
    let currency: string;
    let visibleFieldsData: string | null = null;
    let requiredFieldsData: string | null = null;
    let defaultValuesData: string | null = null;

    if ("visibleFields" in data) {
      const settingsData = SettingsSchema.parse(data);
      validated = settingsData;
      currency = settingsData.currency;

      const visibleFields = settingsData.visibleFields || {};
      const requiredFields = settingsData.requiredFields || {};
      const syncedRequiredFields = syncRequiredWithVisible(
        visibleFields,
        requiredFields
      );

      visibleFieldsData =
        Object.keys(visibleFields).length > 0
          ? JSON.stringify(visibleFields)
          : null;
      requiredFieldsData =
        Object.keys(syncedRequiredFields).length > 0
          ? JSON.stringify(syncedRequiredFields)
          : null;

      const defaultValues = settingsData.defaultValues || {};
      const hasDefaults =
        defaultValues.isBusinessExpense !== null &&
        defaultValues.isBusinessExpense !== undefined;
      const hasBusinessPurpose =
        defaultValues.businessPurpose !== null &&
        defaultValues.businessPurpose !== undefined &&
        defaultValues.businessPurpose.trim() !== "";
      const hasPaymentMethod =
        defaultValues.paymentMethod !== null &&
        defaultValues.paymentMethod !== undefined;

      if (hasDefaults || hasBusinessPurpose || hasPaymentMethod) {
        defaultValuesData = JSON.stringify({
          isBusinessExpense: hasDefaults
            ? defaultValues.isBusinessExpense
            : null,
          businessPurpose: hasBusinessPurpose
            ? defaultValues.businessPurpose
            : null,
          paymentMethod: hasPaymentMethod ? defaultValues.paymentMethod : null,
        });
      }
    } else {
      const onboardingData = OnboardingSchema.parse(data);
      validated = onboardingData;
      currency = onboardingData.country === "CA" ? "CAD" : "USD";

      const defaultVisible = getDefaultVisibleFields(onboardingData.usageType);
      const defaultRequired = getDefaultRequiredFields(
        onboardingData.usageType
      );
      const syncedRequired = syncRequiredWithVisible(
        defaultVisible,
        defaultRequired
      );
      const defaultDefaults = {
        isBusinessExpense: null,
        businessPurpose: null,
        paymentMethod: null,
      };

      visibleFieldsData = JSON.stringify(defaultVisible);
      requiredFieldsData = JSON.stringify(syncedRequired);
      defaultValuesData = JSON.stringify(defaultDefaults);
    }

    const settingsData = {
      userId,
      usageType: validated.usageType,
      country: validated.country,
      province: validated.province || null,
      currency,
      visibleFields: visibleFieldsData,
      requiredFields: requiredFieldsData,
      defaultValues: defaultValuesData,
      updatedAt: new Date(),
    };

    await db.insert(userSettings).values(settingsData).onConflictDoUpdate({
      target: userSettings.userId,
      set: settingsData,
    });

    revalidatePath("/app");
    return { success: true };
  }
);

/**
 * Direct function to get user settings by userId
 * Use this for server-side/background jobs where auth() isn't available
 */
export async function getUserSettingsByUserId(userId: string) {
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (settings.length === 0) {
      return null;
    }

    const setting = settings[0];
    return {
      ...setting,
      visibleFields: setting.visibleFields
        ? JSON.parse(setting.visibleFields)
        : {},
      requiredFields: setting.requiredFields
        ? JSON.parse(setting.requiredFields)
        : {},
      defaultValues: setting.defaultValues
        ? JSON.parse(setting.defaultValues)
        : {
            isBusinessExpense: null,
            businessPurpose: null,
            paymentMethod: null,
          },
    };
}

export const getUserSettings = createAuthenticatedAction(
  "getUserSettings",
  async (userId) => {
    return getUserSettingsByUserId(userId);
  }
);
