import { parse, isValid, parseISO } from "date-fns";

/**
 * Configuration for date conversion
 */
export interface DateConversionConfig {
  type: "date";
  format?: string; // e.g., "DD/MM/YYYY", "MM/DD/YY"
  excelSerial?: boolean; // Handle Excel serial dates
}

/**
 * Configuration for amount conversion
 */
export interface AmountConversionConfig {
  type: "amount";
  reverseSign?: boolean; // Multiply by -1
  removeSymbols?: boolean; // Remove $, €, etc.
  handleParentheses?: boolean; // Treat (100) as -100
}

/**
 * Configuration for description/text conversion
 */
export interface DescriptionConversionConfig {
  type: "description";
  trim?: boolean;
  removeInternalCodes?: boolean;
}

export type ConversionConfig =
  | DateConversionConfig
  | AmountConversionConfig
  | DescriptionConversionConfig;

/**
 * Date converter utility
 */
export class DateConverter {
  /**
   * Convert various date formats to Date object
   */
  static convert(value: any, config: DateConversionConfig): Date | null {
    if (!value) return null;

    // Already a Date object
    if (value instanceof Date && isValid(value)) {
      return value;
    }

    // Excel serial number (days since 1900-01-01)
    if (config.excelSerial && typeof value === "number") {
      return this.excelSerialToDate(value);
    }

    // Try parsing with provided format
    if (config.format && typeof value === "string") {
      try {
        const parsed = parse(value, config.format, new Date());
        if (isValid(parsed)) return parsed;
      } catch {
        // Fall through to other methods
      }
    }

    // Try common formats
    if (typeof value === "string" || typeof value === "number") {
      const str = String(value).trim();
      
      // ISO format
      try {
        const isoDate = parseISO(str);
        if (isValid(isoDate)) return isoDate;
      } catch {
        // Fall through
      }

      // Native Date parsing
      const nativeDate = new Date(str);
      if (isValid(nativeDate)) return nativeDate;
    }

    return null;
  }

  /**
   * Convert Excel serial date to JavaScript Date
   * Excel serial dates are days since 1900-01-01 (with leap year bug)
   */
  private static excelSerialToDate(serial: number): Date | null {
    if (serial < 1) return null;
    
    // Excel incorrectly treats 1900 as a leap year
    const daysFrom1900 = serial > 59 ? serial - 1 : serial;
    const epoch = new Date(1900, 0, 1);
    const date = new Date(epoch.getTime() + (daysFrom1900 - 1) * 24 * 60 * 60 * 1000);
    
    return isValid(date) ? date : null;
  }
}

/**
 * Amount converter utility
 */
export class AmountConverter {
  /**
   * Convert various amount formats to number
   */
  static convert(value: any, config: AmountConversionConfig): number | null {
    if (value === undefined || value === null || value === "") return null;

    // Already a number
    if (typeof value === "number") {
      return config.reverseSign ? -value : value;
    }

    const str = String(value).trim();
    if (!str) return null;

    // Handle accounting format: (100) = -100
    const isNegativeParen = str.startsWith("(") && str.endsWith(")");
    
    // Remove currency symbols, commas, and parentheses
    let cleanStr = str;
    if (config.removeSymbols !== false) {
      cleanStr = cleanStr.replace(/[$€£¥₹,()]/g, "");
    }
    
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return null;

    let result = num;

    // Apply parentheses logic
    if (config.handleParentheses !== false && isNegativeParen) {
      result = -Math.abs(result);
    }

    // Apply sign reversal
    if (config.reverseSign) {
      result = -result;
    }

    return result;
  }
}

/**
 * Description converter utility
 */
export class DescriptionConverter {
  /**
   * Clean and normalize description text
   */
  static convert(value: any, config: DescriptionConversionConfig): string {
    if (!value) return "";

    let str = String(value);

    if (config.trim !== false) {
      str = str.trim();
    }

    // Remove leading = (Excel formula prefix artifact from some bank exports)
    if (str.startsWith("=")) {
      str = str.slice(1);
    }

    if (config.removeInternalCodes) {
      // Remove common internal codes patterns (e.g., "TXN:12345 - Starbucks" -> "Starbucks")
      str = str.replace(/^[A-Z]{2,}:\s*\d+\s*-\s*/i, "");
      str = str.replace(/^\d{4,}\s*-\s*/, ""); // Remove leading numeric codes
    }

    // Normalize whitespace
    str = str.replace(/\s+/g, " ").trim();

    return str;
  }
}

/**
 * Main data converter class that applies conversions based on configuration
 */
export class DataConverter {
  /**
   * Apply conversion to a value based on configuration
   */
  static convert(value: any, config: ConversionConfig): any {
    switch (config.type) {
      case "date":
        return DateConverter.convert(value, config);
      case "amount":
        return AmountConverter.convert(value, config);
      case "description":
        return DescriptionConverter.convert(value, config);
      default:
        return value;
    }
  }

  /**
   * Apply multiple conversions to a row of data
   */
  static convertRow(
    row: Record<string, any>,
    conversions: Record<string, ConversionConfig>
  ): Record<string, any> {
    const converted: Record<string, any> = { ...row };

    for (const [key, config] of Object.entries(conversions)) {
      if (row[key] !== undefined) {
        converted[key] = this.convert(row[key], config);
      }
    }

    return converted;
  }
}

