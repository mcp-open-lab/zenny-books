/**
 * Seed Plaid Standard Categories
 * Based on Plaid's Personal Finance Category (PFC) taxonomy
 * https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";

interface PlaidCategory {
  primary: string;
  detailed: string;
  name: string;
  transactionType: "income" | "expense" | "transfer";
}

// Plaid's standard categories mapped to user-friendly names
const PLAID_CATEGORIES: PlaidCategory[] = [
  // === INCOME ===
  { primary: "INCOME", detailed: "INCOME_WAGES", name: "Salary & Wages", transactionType: "income" },
  { primary: "INCOME", detailed: "INCOME_DIVIDENDS", name: "Dividends", transactionType: "income" },
  { primary: "INCOME", detailed: "INCOME_INTEREST_EARNED", name: "Interest Earned", transactionType: "income" },
  { primary: "INCOME", detailed: "INCOME_RETIREMENT_PENSION", name: "Retirement & Pension", transactionType: "income" },
  { primary: "INCOME", detailed: "INCOME_TAX_REFUND", name: "Tax Refund", transactionType: "income" },
  { primary: "INCOME", detailed: "INCOME_UNEMPLOYMENT", name: "Unemployment Benefits", transactionType: "income" },
  { primary: "INCOME", detailed: "INCOME_OTHER_INCOME", name: "Other Income", transactionType: "income" },

  // === TRANSFER ===
  { primary: "TRANSFER_IN", detailed: "TRANSFER_IN_DEPOSIT", name: "Deposits", transactionType: "transfer" },
  { primary: "TRANSFER_IN", detailed: "TRANSFER_IN_ACCOUNT_TRANSFER", name: "Transfer In", transactionType: "transfer" },
  { primary: "TRANSFER_OUT", detailed: "TRANSFER_OUT_WITHDRAWAL", name: "Withdrawals", transactionType: "transfer" },
  { primary: "TRANSFER_OUT", detailed: "TRANSFER_OUT_ACCOUNT_TRANSFER", name: "Transfer Out", transactionType: "transfer" },

  // === FOOD & DRINK ===
  { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANTS", name: "Restaurants", transactionType: "expense" },
  { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_FAST_FOOD", name: "Fast Food", transactionType: "expense" },
  { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE", name: "Coffee Shops", transactionType: "expense" },
  { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES", name: "Groceries", transactionType: "expense" },
  { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR", name: "Alcohol & Liquor", transactionType: "expense" },

  // === TRANSPORTATION ===
  { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_GAS", name: "Gas & Fuel", transactionType: "expense" },
  { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_PARKING", name: "Parking", transactionType: "expense" },
  { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_PUBLIC_TRANSIT", name: "Public Transit", transactionType: "expense" },
  { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_TAXIS_AND_RIDE_SHARES", name: "Rideshare & Taxi", transactionType: "expense" },
  { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_TOLLS", name: "Tolls", transactionType: "expense" },
  { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_CAR_RENTAL", name: "Car Rental", transactionType: "expense" },
  { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_OTHER", name: "Other Transportation", transactionType: "expense" },

  // === TRAVEL ===
  { primary: "TRAVEL", detailed: "TRAVEL_FLIGHTS", name: "Flights", transactionType: "expense" },
  { primary: "TRAVEL", detailed: "TRAVEL_LODGING", name: "Hotels & Lodging", transactionType: "expense" },
  { primary: "TRAVEL", detailed: "TRAVEL_RENTAL_CARS", name: "Rental Cars", transactionType: "expense" },
  { primary: "TRAVEL", detailed: "TRAVEL_OTHER", name: "Other Travel", transactionType: "expense" },

  // === RENT & UTILITIES ===
  { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_RENT", name: "Rent", transactionType: "expense" },
  { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY", name: "Gas & Electric", transactionType: "expense" },
  { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_INTERNET_AND_CABLE", name: "Internet & Cable", transactionType: "expense" },
  { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_TELEPHONE", name: "Phone", transactionType: "expense" },
  { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_WATER", name: "Water", transactionType: "expense" },
  { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_OTHER_UTILITIES", name: "Other Utilities", transactionType: "expense" },

  // === MEDICAL ===
  { primary: "MEDICAL", detailed: "MEDICAL_DOCTOR", name: "Doctor & Healthcare", transactionType: "expense" },
  { primary: "MEDICAL", detailed: "MEDICAL_DENTAL_CARE", name: "Dental Care", transactionType: "expense" },
  { primary: "MEDICAL", detailed: "MEDICAL_PHARMACIES_AND_SUPPLEMENTS", name: "Pharmacy", transactionType: "expense" },
  { primary: "MEDICAL", detailed: "MEDICAL_EYE_CARE", name: "Eye Care", transactionType: "expense" },
  { primary: "MEDICAL", detailed: "MEDICAL_OTHER_MEDICAL", name: "Other Medical", transactionType: "expense" },

  // === PERSONAL CARE ===
  { primary: "PERSONAL_CARE", detailed: "PERSONAL_CARE_HAIR_AND_BEAUTY", name: "Hair & Beauty", transactionType: "expense" },
  { primary: "PERSONAL_CARE", detailed: "PERSONAL_CARE_GYM_AND_FITNESS", name: "Gym & Fitness", transactionType: "expense" },
  { primary: "PERSONAL_CARE", detailed: "PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING", name: "Laundry & Dry Cleaning", transactionType: "expense" },
  { primary: "PERSONAL_CARE", detailed: "PERSONAL_CARE_OTHER", name: "Other Personal Care", transactionType: "expense" },

  // === ENTERTAINMENT ===
  { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_MUSIC_AND_AUDIO", name: "Music & Audio", transactionType: "expense" },
  { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES", name: "TV & Movies", transactionType: "expense" },
  { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_VIDEO_GAMES", name: "Video Games", transactionType: "expense" },
  { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_EVENTS_AND_TICKETS", name: "Events & Tickets", transactionType: "expense" },
  { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_OTHER", name: "Other Entertainment", transactionType: "expense" },

  // === SHOPPING ===
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES", name: "Clothing & Accessories", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_ELECTRONICS", name: "Electronics", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_DEPARTMENT_STORES", name: "Department Stores", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", name: "Online Shopping", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_SUPERSTORES", name: "Superstores", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_SOFTWARE", name: "Software", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_PET_SUPPLIES", name: "Pet Supplies", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_SPORTING_GOODS", name: "Sporting Goods", transactionType: "expense" },
  { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_OTHER", name: "Other Shopping", transactionType: "expense" },

  // === GENERAL SERVICES ===
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING", name: "Accounting & Financial", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_CONSULTING_AND_LEGAL", name: "Legal Services", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_INSURANCE", name: "Insurance", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_EDUCATION", name: "Education", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_CHILDCARE", name: "Childcare", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_AUTOMOTIVE", name: "Auto Services", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_POSTAGE_AND_SHIPPING", name: "Postage & Shipping", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_STORAGE", name: "Storage", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_VETERINARY", name: "Veterinary", transactionType: "expense" },
  { primary: "GENERAL_SERVICES", detailed: "GENERAL_SERVICES_OTHER", name: "Other Services", transactionType: "expense" },

  // === HOME IMPROVEMENT ===
  { primary: "HOME_IMPROVEMENT", detailed: "HOME_IMPROVEMENT_FURNITURE", name: "Furniture", transactionType: "expense" },
  { primary: "HOME_IMPROVEMENT", detailed: "HOME_IMPROVEMENT_HARDWARE", name: "Hardware & Tools", transactionType: "expense" },
  { primary: "HOME_IMPROVEMENT", detailed: "HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE", name: "Home Repair", transactionType: "expense" },
  { primary: "HOME_IMPROVEMENT", detailed: "HOME_IMPROVEMENT_SECURITY", name: "Home Security", transactionType: "expense" },
  { primary: "HOME_IMPROVEMENT", detailed: "HOME_IMPROVEMENT_OTHER", name: "Other Home", transactionType: "expense" },

  // === LOAN PAYMENTS ===
  { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT", name: "Credit Card Payment", transactionType: "expense" },
  { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_MORTGAGE_PAYMENT", name: "Mortgage Payment", transactionType: "expense" },
  { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_CAR_PAYMENT", name: "Car Payment", transactionType: "expense" },
  { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT", name: "Student Loan", transactionType: "expense" },
  { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT", name: "Personal Loan", transactionType: "expense" },
  { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_OTHER_PAYMENT", name: "Other Loan Payment", transactionType: "expense" },

  // === BANK FEES ===
  { primary: "BANK_FEES", detailed: "BANK_FEES_ATM_FEES", name: "ATM Fees", transactionType: "expense" },
  { primary: "BANK_FEES", detailed: "BANK_FEES_OVERDRAFT_FEES", name: "Overdraft Fees", transactionType: "expense" },
  { primary: "BANK_FEES", detailed: "BANK_FEES_FOREIGN_TRANSACTION_FEES", name: "Foreign Transaction Fees", transactionType: "expense" },
  { primary: "BANK_FEES", detailed: "BANK_FEES_OTHER_BANK_FEES", name: "Other Bank Fees", transactionType: "expense" },

  // === GOVERNMENT & TAX ===
  { primary: "GOVERNMENT_AND_NON_PROFIT", detailed: "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT", name: "Tax Payment", transactionType: "expense" },
  { primary: "GOVERNMENT_AND_NON_PROFIT", detailed: "GOVERNMENT_AND_NON_PROFIT_DONATIONS", name: "Donations & Charity", transactionType: "expense" },
  { primary: "GOVERNMENT_AND_NON_PROFIT", detailed: "GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES", name: "Government Fees", transactionType: "expense" },
];

async function seedPlaidCategories() {
  console.log("Seeding Plaid standard categories...\n");

  let created = 0;
  let skipped = 0;

  for (const cat of PLAID_CATEGORIES) {
    // Check if category with this Plaid detailed code already exists
    const existing = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.type, "system"),
          eq(categories.name, cat.name)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update with Plaid codes if missing
      console.log(`  ✓ "${cat.name}" already exists`);
      skipped++;
      continue;
    }

    // Create new category
    await db.insert(categories).values({
      id: createId(),
      name: cat.name,
      type: "system",
      transactionType: cat.transactionType,
      description: `Plaid: ${cat.primary} > ${cat.detailed}`,
    });

    console.log(`  + Created "${cat.name}"`);
    created++;
  }

  console.log(`\nDone! Created ${created}, Skipped ${skipped} (already existed)`);
}

seedPlaidCategories()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed categories:", error);
    process.exit(1);
  });

