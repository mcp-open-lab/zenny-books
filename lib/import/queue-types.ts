/**
 * Queue job types for batch import processing
 * Type-safe job payload structures for Vercel Queues
 */

import type { ImportType, FileFormat, SourceFormat } from "@/lib/constants";

export type { ImportType, FileFormat };

/**
 * Job payload for processing a single batch item
 */
export interface ImportJobPayload {
  batchId: string;
  batchItemId: string;
  fileUrl: string;
  fileName: string;
  fileFormat: FileFormat;
  userId: string;
  importType: ImportType;
  sourceFormat?: SourceFormat;
  statementType?: "bank_account" | "credit_card";
  currency?: string;
  order: number;
}

/**
 * Queue message wrapper
 */
export interface QueueMessage {
  id: string;
  data: ImportJobPayload;
  timestamp: number;
}

/**
 * Job processing result
 */
export interface JobProcessingResult {
  success: boolean;
  batchItemId: string;
  documentId?: string;
  error?: string;
  errorCode?: string;
  isDuplicate?: boolean;
  duplicateOfDocumentId?: string;
}

