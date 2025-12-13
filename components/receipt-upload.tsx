'use client';

import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { scanReceipt } from "@/lib/modules/receipts/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const UploadButton = generateUploadButton<OurFileRouter>();

export function ReceiptUploader() {
  const router = useRouter();

  return (
    <div className="p-8 border-2 border-dashed rounded-xl text-center">
      <UploadButton
        endpoint="receiptUploader"
        // @ts-ignore
        config={{ mode: "auto" }}
        onClientUploadComplete={async (res) => {
          console.log("[Client] Upload complete:", res);
          if (res && res[0]) {
            toast.info("Processing receipt with AI...");
            try {
              await scanReceipt(res[0].url);
              toast.success("Receipt processed!");
              router.refresh();
            } catch (error) {
              console.error("[Client] Processing error:", error);
              toast.error(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }}
        onUploadProgress={(progress) => {
          console.log("[Client] Upload progress:", progress);
        }}
        onUploadBegin={(name) => {
          console.log("[Client] Upload begin:", name);
        }}
        onUploadError={(error: Error) => {
          console.error("[Client] Upload error:", error);
          toast.error(`Upload failed: ${error.message}`);
        }}
      />
    </div>
  );
}

