"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

type ReceiptImageViewerProps = {
  imageUrl: string;
  merchantName: string | null;
  fileName: string | null;
};

export function ReceiptImageViewer({
  imageUrl,
  merchantName,
  fileName,
}: ReceiptImageViewerProps) {
  const [imageExpanded, setImageExpanded] = useState(false);

  return (
    <>
      <div className="order-2 md:order-1">
        <div
          className="relative w-full h-48 md:h-80 rounded-lg overflow-hidden border bg-muted cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setImageExpanded(true)}
        >
          <Image
            src={imageUrl}
            alt={merchantName ?? "Receipt image"}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
            priority
            unoptimized={imageUrl.includes(".ufs.sh")}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 break-all">
          {fileName || "Uploaded image"}
        </p>
      </div>

      {imageExpanded && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImageExpanded(false);
          }}
        >
          <div className="relative w-full h-full max-w-7xl max-h-[90vh] pointer-events-none">
            <Image
              src={imageUrl}
              alt={merchantName ?? "Receipt image"}
              fill
              sizes="100vw"
              className="object-contain pointer-events-auto"
              priority
              unoptimized={imageUrl.includes(".ufs.sh")}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setImageExpanded(false);
            }}
            className="absolute top-4 right-4 z-[101] text-white hover:text-gray-300 active:bg-black/70 transition-colors p-3 min-w-[44px] min-h-[44px] flex items-center justify-center bg-black/50 rounded-full backdrop-blur-sm touch-manipulation pointer-events-auto"
            aria-label="Close expanded image"
            type="button"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}

