/**
 * Emoji mapping for financial categories
 * Provides emojis for common category names with fuzzy matching
 */

const EMOJI_MAP: Record<string, string> = {
  // Income
  "Salary & Wages": "💼",
  "Freelance Income": "✍️",
  "Investment Income": "📈",
  "Interest Income": "💰",
  "Refunds & Reimbursements": "↩️",
  "Tax Refund": "📄",
  "Gifts & Donations Received": "🎁",
  "Business Revenue": "💵",
  "Client Payments": "💳",
  "Grant Income": "🎓",
  "Other Income": "💵",

  // Food & Dining
  "Food & Dining": "🍽️",
  Restaurants: "🍽️",
  "Fast Food": "🍔",
  "Coffee Shops": "☕",
  Groceries: "🛒",
  "Bars & Nightlife": "🍻",
  "Food & Drink": "🍽️",

  // Transportation
  Transportation: "🚗",
  "Gas Stations": "⛽",
  Parking: "🅿️",
  "Public Transportation": "🚇",
  "Rideshare & Taxi": "🚕",
  "Auto & Transport": "🚗",
  "Other Transportation": "🚗",

  // Travel
  Travel: "✈️",
  Flights: "✈️",
  Hotels: "🏨",
  "Rental Cars": "🚙",
  "Travel & Vacation": "✈️",
  "Other Travel": "✈️",

  // Housing
  "Housing & Rent": "🏠",
  "Rent & Utilities": "🏠",
  Utilities: "💡",
  "Home Improvement": "🔨",
  "Home & Garden": "🏡",
  "Other Home": "🏠",

  // Healthcare
  "Healthcare & Medical": "🏥",
  Medical: "🏥",
  Pharmacy: "💊",
  Dentist: "🦷",
  Doctor: "👨‍⚕️",
  "Other Medical": "🏥",

  // Personal Care
  "Personal Care": "💅",
  "Hair Salons": "✂️",
  Gyms: "💪",
  "Other Personal Care": "💅",

  // Entertainment
  Entertainment: "🎬",
  Movies: "🎬",
  Music: "🎵",
  Sports: "⚽",
  "Other Entertainment": "🎮",

  // Shopping
  "Shopping & Retail": "🛍️",
  "General Merchandise": "🛍️",
  Clothing: "👕",
  Electronics: "📱",
  "Sporting Goods": "⚾",
  "Other Shopping": "🛍️",

  // Services
  "General Services": "🔧",
  "Professional Services": "💼",
  "Software & Tools": "💻",
  "Other Services": "🔧",

  // Business
  "Office Supplies": "📎",
  "Advertising & Marketing": "📢",
  "Business Travel": "✈️",
  "Business Meals": "🍽️",
  "Equipment & Hardware": "🖥️",
  "Rent & Lease": "🏢",
  "Payroll & Contractors": "👥",

  // Education
  Education: "📚",
  Tuition: "🎓",
  "Books & Supplies": "📖",

  // Financial
  Insurance: "🛡️",
  "Bank Fees": "🏦",
  "Other Bank Fees": "🏦",
  "Loan Payments": "💳",
  "Other Loan Payment": "💳",
  Taxes: "📊",
  "Government Fees": "🏛️",
  Subscriptions: "📱",

  // Transfers
  "Transfer In": "⬇️",
  "Transfer Out": "⬆️",
  "Credit Card Payment": "💳",

  // Other
  "Other Expense": "📦",
  Uncategorized: "❓",
};

/**
 * Get emoji for a category name
 * Uses fuzzy matching for common variations
 */
export function getCategoryEmoji(
  categoryName: string | null | undefined
): string {
  if (!categoryName) return "❓";

  // Direct match
  if (EMOJI_MAP[categoryName]) {
    return EMOJI_MAP[categoryName];
  }

  // Fuzzy matching - check if any key contains the category name or vice versa
  const normalizedName = categoryName.toLowerCase();

  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    const normalizedKey = key.toLowerCase();

    // Check if category name contains key or key contains category name
    if (
      normalizedName.includes(normalizedKey) ||
      normalizedKey.includes(normalizedName)
    ) {
      return emoji;
    }

    // Check for common word matches
    const categoryWords = normalizedName.split(/\s+/);
    const keyWords = normalizedKey.split(/\s+/);

    for (const word of categoryWords) {
      if (
        word.length > 3 &&
        keyWords.some((kw) => kw.includes(word) || word.includes(kw))
      ) {
        return emoji;
      }
    }
  }

  // Default fallback based on common patterns
  if (
    normalizedName.includes("income") ||
    normalizedName.includes("salary") ||
    normalizedName.includes("wage")
  ) {
    return "💵";
  }
  if (
    normalizedName.includes("food") ||
    normalizedName.includes("restaurant") ||
    normalizedName.includes("dining")
  ) {
    return "🍽️";
  }
  if (
    normalizedName.includes("transport") ||
    normalizedName.includes("uber") ||
    normalizedName.includes("taxi")
  ) {
    return "🚗";
  }
  if (
    normalizedName.includes("travel") ||
    normalizedName.includes("flight") ||
    normalizedName.includes("hotel")
  ) {
    return "✈️";
  }
  if (
    normalizedName.includes("entertainment") ||
    normalizedName.includes("movie") ||
    normalizedName.includes("music")
  ) {
    return "🎬";
  }
  if (
    normalizedName.includes("shopping") ||
    normalizedName.includes("retail") ||
    normalizedName.includes("store")
  ) {
    return "🛍️";
  }
  if (
    normalizedName.includes("medical") ||
    normalizedName.includes("health") ||
    normalizedName.includes("doctor")
  ) {
    return "🏥";
  }

  return "📦"; // Default fallback
}

/**
 * Get emoji for a category (with fallback to name-based lookup)
 */
export function getCategoryEmojiFromCategory(
  category: { name: string; icon?: string | null } | null | undefined
): string {
  if (!category) return "❓";

  // Use stored icon if available
  if (category.icon) {
    return category.icon;
  }

  // Fall back to name-based lookup
  return getCategoryEmoji(category.name);
}
