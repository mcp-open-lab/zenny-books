/**
 * Financial Constants
 * Currencies, payment methods, and financial-related constants
 */

// Currencies
export const CURRENCIES = ["USD", "CAD"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Payment Methods
export const PAYMENT_METHODS = ["cash", "card", "check", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Countries
export const COUNTRIES = ["US", "CA"] as const;
export type Country = (typeof COUNTRIES)[number];

// US States
export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;
export type UsState = (typeof US_STATES)[number];

// Canadian Provinces
export const CANADIAN_PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;
export type CanadianProvince = (typeof CANADIAN_PROVINCES)[number];

// Account Types
export const ACCOUNT_TYPES = ["checking", "savings", "credit", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Transaction Directions
export const TRANSACTION_DIRECTIONS = ["in", "out"] as const;
export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

// Business Types
export const BUSINESS_TYPES = ["business", "contract"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

