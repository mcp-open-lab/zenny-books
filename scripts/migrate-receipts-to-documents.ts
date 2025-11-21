import { db } from "@/lib/db";
import { receipts, documents } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";

function getFileFormat(imageUrl: string): string {
  const extension = imageUrl.split(".").pop()?.toLowerCase() || "";
  const formatMap: Record<string, string> = {
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    gif: "gif",
    pdf: "pdf",
  };
  return formatMap[extension] || "jpg";
}

function getMimeType(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return mimeTypes[extension || ""] || "image/jpeg";
}

async function migrateReceiptsToDocuments() {
  console.log("Starting migration: Creating documents for existing receipts...");

  // Find all receipts without documentId
  const receiptsWithoutDocuments = await db
    .select()
    .from(receipts)
    .where(isNull(receipts.documentId));

  console.log(`Found ${receiptsWithoutDocuments.length} receipts without documents`);

  if (receiptsWithoutDocuments.length === 0) {
    console.log("No receipts to migrate. Exiting.");
    return;
  }

  let migrated = 0;
  let errors = 0;

  for (const receipt of receiptsWithoutDocuments) {
    try {
      // Create document for this receipt
      const fileFormat = getFileFormat(receipt.imageUrl);
      const mimeType = getMimeType(receipt.imageUrl);

      const [document] = await db
        .insert(documents)
        .values({
          userId: receipt.userId,
          documentType: "receipt",
          fileFormat,
          fileName: receipt.fileName || null,
          fileUrl: receipt.imageUrl,
          mimeType,
          status: receipt.status === "needs_review" ? "needs_review" : "extracted",
          extractionMethod: "ai_gemini",
          extractedAt: receipt.createdAt || new Date(),
        })
        .returning();

      // Update receipt with documentId
      await db
        .update(receipts)
        .set({ documentId: document.id })
        .where(eq(receipts.id, receipt.id));

      migrated++;
      if (migrated % 10 === 0) {
        console.log(`Migrated ${migrated}/${receiptsWithoutDocuments.length} receipts...`);
      }
    } catch (error) {
      console.error(`Error migrating receipt ${receipt.id}:`, error);
      errors++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`✅ Successfully migrated: ${migrated}`);
  console.log(`❌ Errors: ${errors}`);
}

migrateReceiptsToDocuments()
  .then(() => {
    console.log("Migration script finished.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });

