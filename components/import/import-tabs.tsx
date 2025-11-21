"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportUploadZone } from "@/components/import/import-upload-zone";
import { BatchesList } from "@/components/import/batches-list";
import type { ImportBatch } from "@/lib/import/batch-types";

interface ImportTabsProps {
  initialBatches: ImportBatch[];
  initialCursor: string | null;
  initialHasMore: boolean;
  initialTab?: string;
}

export function ImportTabs({
  initialBatches,
  initialCursor,
  initialHasMore,
  initialTab = "import",
}: ImportTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Use initialTab for first render to match server, then sync with URL
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    // Sync with URL after hydration
    const urlTab = searchParams.get("tab") || "import";
    setActiveTab(urlTab);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "import") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    router.push(`/app/import?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList>
        <TabsTrigger value="import">Import</TabsTrigger>
        <TabsTrigger value="jobs">View Jobs</TabsTrigger>
      </TabsList>
      <TabsContent value="import" className="mt-6">
        <ImportUploadZone />
      </TabsContent>
      <TabsContent value="jobs" className="mt-6">
        <BatchesList
          initialBatches={initialBatches}
          initialCursor={initialCursor}
          initialHasMore={initialHasMore}
        />
      </TabsContent>
    </Tabs>
  );
}

