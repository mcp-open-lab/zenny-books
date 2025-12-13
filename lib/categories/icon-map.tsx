/**
 * Lucide icon mapping for financial categories
 * Provides professional icons for common category names with fuzzy matching
 */

import {
  Briefcase,
  PenTool,
  TrendingUp,
  DollarSign,
  RotateCcw,
  FileText,
  Gift,
  CreditCard,
  GraduationCap,
  UtensilsCrossed,
  Coffee,
  ShoppingCart,
  Beer,
  Car,
  Fuel,
  ParkingCircle,
  Train,
  Plane,
  Hotel,
  CarTaxiFront,
  Home,
  Lightbulb,
  Hammer,
  TreePine,
  HeartPulse,
  Pill,
  Stethoscope,
  Scissors,
  Dumbbell,
  Film,
  Music,
  Gamepad2,
  ShoppingBag,
  Shirt,
  Smartphone,
  Activity,
  Wrench,
  Laptop,
  Paperclip,
  Megaphone,
  Monitor,
  Building2,
  Users,
  BookOpen,
  Book,
  Shield,
  Banknote,
  Receipt,
  Building,
  CircleHelp,
  Package,
  ArrowDown,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  // Income
  "Salary & Wages": Briefcase,
  "Freelance Income": PenTool,
  "Investment Income": TrendingUp,
  "Interest Income": DollarSign,
  "Refunds & Reimbursements": RotateCcw,
  "Tax Refund": FileText,
  "Gifts & Donations Received": Gift,
  "Business Revenue": DollarSign,
  "Client Payments": CreditCard,
  "Grant Income": GraduationCap,
  "Other Income": DollarSign,

  // Food & Dining
  "Food & Dining": UtensilsCrossed,
  Restaurants: UtensilsCrossed,
  "Fast Food": UtensilsCrossed,
  "Coffee Shops": Coffee,
  Groceries: ShoppingCart,
  "Bars & Nightlife": Beer,
  "Food & Drink": UtensilsCrossed,

  // Transportation
  Transportation: Car,
  "Gas Stations": Fuel,
  Parking: ParkingCircle,
  "Public Transportation": Train,
  "Rideshare & Taxi": CarTaxiFront,
  "Auto & Transport": Car,
  "Other Transportation": Car,

  // Travel
  Travel: Plane,
  Flights: Plane,
  Hotels: Hotel,
  "Rental Cars": CarTaxiFront,
  "Travel & Vacation": Plane,
  "Other Travel": Plane,

  // Housing
  "Housing & Rent": Home,
  "Rent & Utilities": Home,
  Utilities: Lightbulb,
  "Home Improvement": Hammer,
  "Home & Garden": TreePine,
  "Other Home": Home,

  // Healthcare
  "Healthcare & Medical": HeartPulse,
  Medical: HeartPulse,
  Pharmacy: Pill,
  Dentist: Stethoscope,
  Doctor: Stethoscope,
  "Other Medical": HeartPulse,

  // Personal Care
  "Personal Care": Scissors,
  "Hair Salons": Scissors,
  Gyms: Dumbbell,
  "Other Personal Care": Scissors,

  // Entertainment
  Entertainment: Film,
  Movies: Film,
  Music: Music,
  Sports: Activity,
  "Other Entertainment": Gamepad2,

  // Shopping
  "Shopping & Retail": ShoppingBag,
  "General Merchandise": ShoppingBag,
  Clothing: Shirt,
  Electronics: Smartphone,
  "Sporting Goods": Activity,
  "Other Shopping": ShoppingBag,

  // Services
  "General Services": Wrench,
  "Professional Services": Briefcase,
  "Software & Tools": Laptop,
  "Other Services": Wrench,

  // Business
  "Office Supplies": Paperclip,
  "Advertising & Marketing": Megaphone,
  "Business Travel": Plane,
  "Business Meals": UtensilsCrossed,
  "Equipment & Hardware": Monitor,
  "Rent & Lease": Building2,
  "Payroll & Contractors": Users,

  // Education
  Education: BookOpen,
  Tuition: GraduationCap,
  "Books & Supplies": Book,

  // Financial
  Insurance: Shield,
  "Bank Fees": Banknote,
  "Other Bank Fees": Banknote,
  "Loan Payments": CreditCard,
  "Other Loan Payment": CreditCard,
  Taxes: Receipt,
  "Government Fees": Building,
  Subscriptions: Smartphone,

  // Transfers
  "Transfer In": ArrowDown,
  "Transfer Out": ArrowUp,
  "Credit Card Payment": CreditCard,

  // Other
  "Other Expense": Package,
  Uncategorized: CircleHelp,
};

/**
 * Get Lucide icon component for a category name
 * Uses fuzzy matching for common variations
 */
export function getCategoryIcon(
  categoryName: string | null | undefined
): LucideIcon {
  if (!categoryName) return CircleHelp;

  // Direct match
  if (ICON_MAP[categoryName]) {
    return ICON_MAP[categoryName];
  }

  // Fuzzy matching - check if any key contains the category name or vice versa
  const normalizedName = categoryName.toLowerCase();

  for (const [key, icon] of Object.entries(ICON_MAP)) {
    const normalizedKey = key.toLowerCase();

    // Check if category name contains key or key contains category name
    if (
      normalizedName.includes(normalizedKey) ||
      normalizedKey.includes(normalizedName)
    ) {
      return icon;
    }

    // Check for common word matches
    const categoryWords = normalizedName.split(/\s+/);
    const keyWords = normalizedKey.split(/\s+/);

    for (const word of categoryWords) {
      if (
        word.length > 3 &&
        keyWords.some((kw) => kw.includes(word) || word.includes(kw))
      ) {
        return icon;
      }
    }
  }

  // Default fallback based on common patterns
  if (
    normalizedName.includes("income") ||
    normalizedName.includes("salary") ||
    normalizedName.includes("wage")
  ) {
    return DollarSign;
  }
  if (
    normalizedName.includes("food") ||
    normalizedName.includes("restaurant") ||
    normalizedName.includes("dining")
  ) {
    return UtensilsCrossed;
  }
  if (
    normalizedName.includes("transport") ||
    normalizedName.includes("uber") ||
    normalizedName.includes("taxi")
  ) {
    return Car;
  }
  if (
    normalizedName.includes("travel") ||
    normalizedName.includes("flight") ||
    normalizedName.includes("hotel")
  ) {
    return Plane;
  }
  if (
    normalizedName.includes("entertainment") ||
    normalizedName.includes("movie") ||
    normalizedName.includes("music")
  ) {
    return Film;
  }
  if (
    normalizedName.includes("shopping") ||
    normalizedName.includes("retail") ||
    normalizedName.includes("store")
  ) {
    return ShoppingBag;
  }
  if (
    normalizedName.includes("medical") ||
    normalizedName.includes("health") ||
    normalizedName.includes("doctor")
  ) {
    return HeartPulse;
  }

  return Package; // Default fallback
}

/**
 * Get icon component for a category (with fallback to name-based lookup)
 */
export function getCategoryIconFromCategory(
  category: { name: string; icon?: string | null } | null | undefined
): LucideIcon {
  if (!category) return CircleHelp;

  // TODO: If we store icon names in DB, map them here
  // For now, always use name-based lookup
  return getCategoryIcon(category.name);
}

