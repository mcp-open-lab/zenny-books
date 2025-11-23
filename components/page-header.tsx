"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  backHref?: string;
  /**
   * If true, uses browser back instead of backHref
   * @default true when backHref is not provided
   */
  useHistoryBack?: boolean;
};

export function PageHeader({ title, backHref, useHistoryBack }: PageHeaderProps) {
  const router = useRouter();
  
  // Default to history back if no backHref is provided
  const shouldUseHistoryBack = useHistoryBack ?? !backHref;

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      {(shouldUseHistoryBack || backHref) && (
        <>
          {shouldUseHistoryBack ? (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
          <Button variant="ghost" size="icon" asChild>
              <Link href={backHref!}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          )}
        </>
        )}
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  );
}
