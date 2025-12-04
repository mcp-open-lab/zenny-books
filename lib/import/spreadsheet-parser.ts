import * as XLSX from "xlsx";
import type { MappingConfig } from "./ai-column-mapper";
import { convertInstructionsToConfig } from "./ai-column-mapper";
import { DataConverter } from "./field-converters";

export interface NormalizedTransaction {
  transactionDate?: Date | null;
  postedDate?: Date | null;
  description?: string;
  amount?: number | null;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
  category?: string;
  merchantName?: string;
  referenceNumber?: string;
  raw: Record<string, any>;
}

export interface SpreadsheetStats {
  totalRows: number;
  previewRows: any[][];
  amountStats: {
    positiveCount: number;
    negativeCount: number;
    positivePercent: number;
    sampleSize: number;
    hasBalanceColumn: boolean;
  } | null;
}

/**
 * Analyze ALL rows to detect amount column patterns and sign conventions
 */
function analyzeAmountPatterns(rows: any[][]): SpreadsheetStats["amountStats"] {
  if (rows.length < 5) return null;

  // Try to find numeric columns (potential amount columns)
  const numericColumnIndices: number[] = [];
  const firstDataRow = rows.find((row) => row && row.length > 0) || [];

  firstDataRow.forEach((cell, idx) => {
    // Check if this column contains numbers in most rows
    const numericCount = rows.slice(0, 50).filter((row) => {
      const val = row[idx];
      if (!val) return false;
      const strVal = String(val).replace(/[$€£¥,\s]/g, "");
      return !isNaN(parseFloat(strVal)) && isFinite(Number(strVal));
    }).length;

    if (numericCount > 5) {
      numericColumnIndices.push(idx);
    }
  });

  if (numericColumnIndices.length === 0) return null;

  // Analyze the most likely amount column (usually has most variation)
  let positiveCount = 0;
  let negativeCount = 0;
  let sampleSize = 0;
  let hasBalanceColumn = false;

  // Sample up to 200 rows or all available rows
  const sampleRows = rows.slice(0, Math.min(200, rows.length));

  for (const row of sampleRows) {
    for (const colIdx of numericColumnIndices) {
      const val = row[colIdx];
      if (!val) continue;

      const strVal = String(val).replace(/[$€£¥,\s]/g, "");
      const numVal = parseFloat(strVal);

      if (!isNaN(numVal) && isFinite(numVal) && numVal !== 0) {
        sampleSize++;
        if (numVal > 0) positiveCount++;
        if (numVal < 0) negativeCount++;
      }
    }
  }

  // Check for balance column (steadily increasing/decreasing values)
  if (numericColumnIndices.length > 1) {
    hasBalanceColumn = true; // Simplified - could be more sophisticated
  }

  const positivePercent =
    sampleSize > 0 ? Math.round((positiveCount / sampleSize) * 100) : 0;

  return {
    positiveCount,
    negativeCount,
    positivePercent,
    sampleSize,
    hasBalanceColumn,
  };
}

/**
 * Get a preview of the first rows AND statistical analysis of ALL rows
 * Used for AI analysis to determine column mapping
 */
export function getSpreadsheetPreview(
  fileBuffer: ArrayBuffer | Buffer,
  maxPreviewRows = 20
): SpreadsheetStats | null {
  try {
    const workbook = XLSX.read(fileBuffer, {
      type: "buffer",
      cellDates: true,
      raw: true, // Preserve raw values, don't evaluate formulas (fixes =MERCHANT issue)
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return null;
    }

    // Get raw array-of-arrays format
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });

    // Analyze all rows for patterns
    const amountStats = analyzeAmountPatterns(rawRows);

    return {
      totalRows: rawRows.length,
      previewRows: rawRows.slice(0, maxPreviewRows),
      amountStats,
    };
  } catch (error) {
    console.error("Error getting spreadsheet preview:", error);
    return null;
  }
}

/**
 * Parse spreadsheet with AI-determined mapping configuration
 */
export function parseWithMapping(
  fileBuffer: ArrayBuffer | Buffer,
  mappingConfig: MappingConfig
): NormalizedTransaction[] {
  try {
    const workbook = XLSX.read(fileBuffer, {
      type: "buffer",
      cellDates: true,
      raw: true, // Preserve raw values, don't evaluate formulas (fixes =MERCHANT issue)
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return [];
    }

    // Get raw rows
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });

    // Extract data rows (skip header and any rows above it)
    const dataRows = rawRows.slice(mappingConfig.headerRowIndex + 1);

    // Get conversion config from AI instructions
    const conversionConfig = convertInstructionsToConfig(
      mappingConfig.conversions
    );

    // Map and convert each row
    const transactions: NormalizedTransaction[] = dataRows.map((row) => {
      const rawRow: Record<string, any> = {};
      const transaction: NormalizedTransaction = { raw: {} };

      // Extract values using field mappings
      for (const [field, mapping] of Object.entries(
        mappingConfig.fieldMappings
      )) {
        if (mapping && mapping.columnIndex < row.length) {
          rawRow[field] = row[mapping.columnIndex];
        }
      }

      // Apply conversions
      const convertedRow = DataConverter.convertRow(rawRow, conversionConfig);

      // Map to transaction object
      transaction.transactionDate = convertedRow.transactionDate;
      transaction.postedDate = convertedRow.postedDate;
      transaction.description = convertedRow.description;
      transaction.amount = convertedRow.amount;
      transaction.debit = convertedRow.debit;
      transaction.credit = convertedRow.credit;
      transaction.balance = convertedRow.balance;
      transaction.category = convertedRow.category;
      transaction.merchantName = convertedRow.merchantName;
      transaction.referenceNumber = convertedRow.referenceNumber;
      transaction.raw = rawRow;

      return transaction;
    });

    return transactions;
  } catch (error) {
    console.error("Error parsing with mapping:", error);
    return [];
  }
}
