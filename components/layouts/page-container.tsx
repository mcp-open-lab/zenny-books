import { cn } from "@/lib/utils";
import { layoutTheme, PageContainerSize } from "@/lib/theme/layout";

type PageContainerProps = {
  children: React.ReactNode;
  /**
   * Container size variant
   * - standard: 896px max-width (most pages)
   * - wide: 1152px max-width (data-heavy pages)
   * - narrow: 672px max-width (focused pages)
   * - tight: 1152px max-width with tighter spacing (import pages)
   */
  size?: PageContainerSize;
  /**
   * Additional CSS classes
   */
  className?: string;
};

/**
 * PageContainer - Consistent page layout wrapper inspired by Wealthsimple's design
 * 
 * Encapsulates:
 * - Consistent max-widths across all pages
 * - Standardized padding and spacing
 * - Centered layout with responsive behavior
 * 
 * Usage:
 * ```tsx
 * <PageContainer size="standard">
 *   <PageHeader title="My Page" />
 *   <Content />
 * </PageContainer>
 * ```
 */
export function PageContainer({
  children,
  size = "standard",
  className,
}: PageContainerProps) {
  const containerClass = layoutTheme.container[size];
  
  return (
    <div className={cn(containerClass, className)}>
      {children}
    </div>
  );
}

