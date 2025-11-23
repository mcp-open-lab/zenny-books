/**
 * Layout theme constants aligned with shadcn/ui and Wealthsimple's design philosophy
 *
 * Design Principles:
 * - Simplicity: Clear, focused layouts
 * - Accessibility: Generous spacing and readable content widths
 * - Consistency: Unified max-widths across all pages
 * - shadcn Compliance: Uses CSS variables for theming, Tailwind's 4px spacing scale
 *
 * Max Width Guidelines (aligned with Wealthsimple):
 * - Principal content areas: 896px (optimal reading width)
 * - Wider content areas: 1152px (for data-heavy pages)
 * - Narrow content: 672px (for focused, single-purpose pages)
 *
 * Spacing Guidelines (aligned with Tailwind's 0.25rem/4px scale):
 * - Uses Tailwind's standard spacing scale (p-4, p-6, space-y-4, space-y-6, space-y-8)
 * - Generous whitespace for clarity and breathability
 */

export const layoutTheme = {
  /**
   * Max widths for page containers
   * Uses Tailwind theme extension (max-w-container-*) for consistency
   * CSS variables in globals.css allow for future theme customization
   * Based on Wealthsimple's principal content area (600-900px) and main containers (1200-1440px)
   */
  maxWidth: {
    /**
     * Standard content width - optimal for reading and focused interactions
     * Used for most pages: forms, detail views, settings
     * Maps to max-w-container-standard (896px / 56rem)
     */
    content: "max-w-container-standard",

    /**
     * Wider content width - for data-heavy pages with tables, lists, or complex layouts
     * Used for: import pages, merchant detail pages, dashboards with multiple columns
     * Maps to max-w-container-wide (1152px / 72rem)
     */
    wide: "max-w-container-wide",

    /**
     * Narrow content width - for focused, single-purpose pages
     * Used for: onboarding flows, simple forms, confirmation pages
     * Maps to max-w-container-narrow (672px / 42rem)
     */
    narrow: "max-w-container-narrow",

    /**
     * Standard Tailwind classes (equivalent values)
     * Can be used as fallback or for consistency with existing code
     */
    tailwind: {
      content: "max-w-4xl", // 896px - same as container-standard
      wide: "max-w-6xl", // 1152px - same as container-wide
      narrow: "max-w-2xl", // 672px - same as container-narrow
    },
  },

  /**
   * Spacing scale (Tailwind's 0.25rem/4px increments)
   * Wealthsimple uses generous whitespace for clarity and breathability
   * All values align with Tailwind's default spacing scale
   */
  spacing: {
    /**
     * Standard page padding - provides comfortable edge spacing
     * Uses p-6 (24px / 1.5rem) - generous but not excessive
     */
    pagePadding: "p-6",

    /**
     * Vertical spacing between major page sections
     * Uses space-y-8 (32px / 2rem) - generous section separation
     */
    sectionGap: "space-y-8",

    /**
     * Vertical spacing for tighter layouts (e.g., import pages)
     * Uses space-y-6 (24px / 1.5rem) - balanced for dense content
     */
    tightGap: "space-y-6",

    /**
     * Vertical spacing for compact layouts (e.g., list views)
     * Uses space-y-4 (16px / 1rem) - tighter for lists
     */
    compactGap: "space-y-4",
  },

  /**
   * Container classes for common layout patterns
   * Uses Tailwind theme-extended max-widths (max-w-container-*)
   * Follows shadcn pattern: utility-first with theme extension support
   * All containers are centered (mx-auto) and full-width responsive (w-full)
   */
  container: {
    /**
     * Standard page container - most common pattern
     * Centered, max-width content, standard padding and spacing
     * Uses: max-w-container-standard (896px), p-6 (24px), space-y-8 (32px)
     */
    standard: "flex-1 max-w-container-standard mx-auto w-full p-6 space-y-8",

    /**
     * Wide page container - for data-heavy pages
     * Uses: max-w-container-wide (1152px), p-6 (24px), space-y-8 (32px)
     */
    wide: "flex-1 max-w-container-wide mx-auto w-full p-6 space-y-8",

    /**
     * Narrow page container - for focused, single-purpose pages
     * Uses: max-w-container-narrow (672px), p-6 (24px), space-y-8 (32px)
     */
    narrow: "flex-1 max-w-container-narrow mx-auto w-full p-6 space-y-8",

    /**
     * Tight layout - for import pages and similar dense content
     * Uses: max-w-container-wide (1152px), p-6 (24px), space-y-6 (24px - tighter)
     */
    tight: "flex-1 max-w-container-wide mx-auto w-full p-6 space-y-6",
  },
} as const;

/**
 * Page container size variants
 */
export type PageContainerSize = "standard" | "wide" | "narrow" | "tight";
