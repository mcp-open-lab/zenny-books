/**
 * Duplicate Detection for Import Batches
 *
 * Detects duplicates using multiple strategies:
 * 1. Exact image match (same fileUrl or fileSizeBytes)
 * 2. Merchant + Date + Amount match (fuzzy match)
 */

import { db } from "@/lib/db";
import { documents, receipts, importBatchItems } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type DuplicateMatchType =
  | "exact_image"
  | "merchant_date_amount"
  | "manual";

export interface DuplicateMatch {
  documentId: string;
  matchType: DuplicateMatchType;
  confidence: "high" | "medium" | "low";
}

/**
 * Check if a file URL already exists in the database
 * Excludes the current document if provided
 */
async function checkExactImageMatch(
  fileUrl: string,
  userId: string,
  excludeDocumentId?: string
): Promise<string | null> {
  const conditions = [
    eq(documents.fileUrl, fileUrl),
    eq(documents.userId, userId),
  ];

  // Exclude current document if provided
  if (excludeDocumentId) {
    conditions.push(sql`${documents.id} != ${excludeDocumentId}`);
  }

  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(...conditions))
    .limit(1);

  return existing.length > 0 ? existing[0].id : null;
}

/**
 * Check if file size matches an existing document
 * This is a quick check before downloading the full image
 * Excludes the current document if provided
 */
async function checkFileSizeMatch(
  fileSizeBytes: number | undefined,
  userId: string,
  excludeDocumentId?: string
): Promise<string[]> {
  if (!fileSizeBytes) return [];

  const conditions = [
    eq(documents.fileSizeBytes, fileSizeBytes),
    eq(documents.userId, userId),
  ];

  // Exclude current document if provided
  if (excludeDocumentId) {
    conditions.push(sql`${documents.id} != ${excludeDocumentId}`);
  }

  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(...conditions))
    .limit(10); // Limit to avoid too many matches

  return existing.map((d) => d.id);
}

/**
 * Check for merchant + date + amount match
 * This is a fuzzy match that catches receipts that are the same but uploaded differently
 * Excludes the current document if provided
 */
async function checkMerchantDateAmountMatch(
  merchantName: string | null,
  date: Date | null,
  totalAmount: string | null,
  userId: string,
  excludeDocumentId?: string
): Promise<string[]> {
  if (!merchantName || !date || !totalAmount) {
    return [];
  }

  const conditions = [
    eq(receipts.userId, userId),
    eq(receipts.merchantName, merchantName),
    eq(receipts.totalAmount, totalAmount),
    // Match date within same day (ignore time)
    sql`DATE(${receipts.date}) = DATE(${date})`,
  ];

  // Exclude current document if provided
  if (excludeDocumentId) {
    conditions.push(sql`${receipts.documentId} != ${excludeDocumentId}`);
  }

  // Query receipts with matching merchant, date (within same day), and amount
  const matches = await db
    .select({ documentId: receipts.documentId })
    .from(receipts)
    .where(and(...conditions))
    .limit(10);

  return matches.map((r) => r.documentId);
}

/**
 * Main duplicate detection function
 * Checks multiple strategies and returns the best match
 * Excludes the current document if provided
 */
export async function detectDuplicate(
  fileUrl: string,
  fileSizeBytes: number | undefined,
  userId: string,
  merchantName?: string | null,
  date?: Date | null,
  totalAmount?: string | null,
  excludeDocumentId?: string
): Promise<DuplicateMatch | null> {
  // Strategy 1: Exact image match (highest confidence)
  const exactMatch = await checkExactImageMatch(
    fileUrl,
    userId,
    excludeDocumentId
  );
  if (exactMatch) {
    return {
      documentId: exactMatch,
      matchType: "exact_image",
      confidence: "high",
    };
  }

  // Strategy 2: File size match (medium confidence - could be false positive)
  if (fileSizeBytes) {
    const sizeMatches = await checkFileSizeMatch(
      fileSizeBytes,
      userId,
      excludeDocumentId
    );
    if (sizeMatches.length > 0) {
      // If only one match, it's likely the same file
      if (sizeMatches.length === 1) {
        return {
          documentId: sizeMatches[0],
          matchType: "exact_image",
          confidence: "medium",
        };
      }
      // Multiple matches with same size - need more info
      // Fall through to merchant/date/amount check
    }
  }

  // Strategy 3: Merchant + Date + Amount match (medium confidence)
  // Only check if we have all required fields
  if (merchantName && date && totalAmount) {
    const merchantMatches = await checkMerchantDateAmountMatch(
      merchantName,
      date,
      totalAmount,
      userId,
      excludeDocumentId
    );

    if (merchantMatches.length > 0) {
      // Prefer exact image matches if we have file size matches
      if (fileSizeBytes) {
        const sizeMatches = await checkFileSizeMatch(
          fileSizeBytes,
          userId,
          excludeDocumentId
        );
        const intersection = merchantMatches.filter((id) =>
          sizeMatches.includes(id)
        );
        if (intersection.length > 0) {
          return {
            documentId: intersection[0],
            matchType: "merchant_date_amount",
            confidence: "high",
          };
        }
      }

      // Return first merchant match
      return {
        documentId: merchantMatches[0],
        matchType: "merchant_date_amount",
        confidence: "medium",
      };
    }
  }

  return null;
}

/**
 * Check if a batch item is a duplicate
 * This is called during batch processing after extraction
 * Note: We need to exclude the current document from duplicate checks
 */
export async function checkBatchItemDuplicate(
  batchItemId: string,
  userId: string,
  currentDocumentId?: string
): Promise<DuplicateMatch | null> {
  // Get the batch item
  const item = await db
    .select()
    .from(importBatchItems)
    .where(eq(importBatchItems.id, batchItemId))
    .limit(1);

  if (item.length === 0 || !item[0].fileUrl) {
    return null;
  }

  const batchItem = item[0];

  // If item already has a document, get receipt data for matching
  let merchantName: string | null = null;
  let date: Date | null = null;
  let totalAmount: string | null = null;

  const documentIdToCheck = currentDocumentId || batchItem.documentId;

  if (documentIdToCheck) {
    const receipt = await db
      .select({
        merchantName: receipts.merchantName,
        date: receipts.date,
        totalAmount: receipts.totalAmount,
      })
      .from(receipts)
      .where(eq(receipts.documentId, documentIdToCheck))
      .limit(1);

    if (receipt.length > 0) {
      merchantName = receipt[0].merchantName;
      date = receipt[0].date;
      totalAmount = receipt[0].totalAmount;
    }
  }

  // Check for duplicates (but exclude current document)
  if (!batchItem.fileUrl) {
    return null;
  }

  const match = await detectDuplicate(
    batchItem.fileUrl,
    batchItem.fileSizeBytes || undefined,
    userId,
    merchantName,
    date,
    totalAmount,
    documentIdToCheck || undefined
  );

  return match;
}

/**
 * Mark a batch item as duplicate
 */
export async function markBatchItemAsDuplicate(
  batchItemId: string,
  duplicateOfDocumentId: string,
  matchType: DuplicateMatchType
): Promise<void> {
  await db
    .update(importBatchItems)
    .set({
      status: "duplicate",
      duplicateOfDocumentId: duplicateOfDocumentId,
      duplicateMatchType: matchType,
      processedAt: new Date(),
    })
    .where(eq(importBatchItems.id, batchItemId));
}
