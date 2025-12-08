"use server";

import { revalidatePath } from "next/cache";
import { createPublicAction } from "@/lib/safe-action";
import { processReceipt } from "@/lib/services/receipts";
import { toUserMessage } from "@/lib/errors";
import { logError } from "@/lib/observability/log";

async function scanReceiptHandler(
  imageUrl: string,
  batchId?: string,
  userId?: string,
  fileName?: string
) {
  try {
    await processReceipt({ imageUrl, batchId, userId, fileName });
    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    logError("Failed to scan receipt", error, { batchId });
    throw new Error(`Failed to scan receipt: ${toUserMessage(error)}`);
  }
}

export const scanReceipt = createPublicAction("scanReceipt", scanReceiptHandler, {
  requireAuth: true,
});

export { scanReceiptHandler };
