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

/**
 * Get a preview of the first rows of a spreadsheet (raw array-of-arrays format)
 * Used for AI analysis to determine column mapping
 */
export function getSpreadsheetPreview(
  fileBuffer: ArrayBuffer | Buffer,
  maxRows = 20
): any[][] | null {
  try {
    const workbook = XLSX.read(fileBuffer, {
      type: "buffer",
      cellDates: true,
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

    return rawRows.slice(0, maxRows);
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
    const conversionConfig = convertInstructionsToConfig(mappingConfig.conversions);

    // Map and convert each row
    const transactions: NormalizedTransaction[] = dataRows.map((row) => {
      const rawRow: Record<string, any> = {};
      const transaction: NormalizedTransaction = { raw: {} };

      // Extract values using field mappings
      for (const [field, mapping] of Object.entries(mappingConfig.fieldMappings)) {
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

