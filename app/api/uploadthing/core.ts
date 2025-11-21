import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { devLogger } from "@/lib/dev-logger";

const f = createUploadthing();

export const ourFileRouter = {
  // Allow up to 16MB to give room for higher-res images, while we still compress on mobile
  receiptUploader: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(({ metadata, file }) => {
      // Dev logging only - uploads contain PII
      devLogger.info("Upload complete", {
        userId: metadata.userId,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: file.url,
        action: "uploadComplete",
      });
      // Return immediately - processing happens via client-triggered action
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
