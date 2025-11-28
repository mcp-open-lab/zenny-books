#!/usr/bin/env npx tsx
/**
 * Test PDF extraction + LLM parsing pipeline
 *
 * Usage: npx tsx scripts/test-pdf-extraction.ts <pdf-path>
 * Output: .output/
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import {
  extractPdfText,
  isScannedPdf,
  parseTransactionsFromPdf,
  transactionsToCsv,
} from "../lib/import/pdf-table-extractor";

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error("Usage: npx tsx scripts/test-pdf-extraction.ts <pdf-path>");
    process.exit(1);
  }

  console.log(`\n📄 Extracting from: ${pdfPath}\n`);

  // Step 1: Extract PDF text
  const buffer = readFileSync(pdfPath);
  const result = await extractPdfText(buffer);

  console.log(`📊 Metadata:`);
  console.log(`   Pages: ${result.metadata.pageCount}`);
  console.log(`   Title: ${result.metadata.title || "N/A"}`);
  console.log(`   Scanned: ${isScannedPdf(result) ? "Yes (low text)" : "No"}`);
  console.log(`   Text length: ${result.text.length} chars`);

  // Step 2: Parse into NormalizedTransaction[] using LLM
  console.log(`\n🤖 Parsing transactions with LLM...`);
  const transactions = await parseTransactionsFromPdf(result);
  console.log(`📋 Extracted: ${transactions.length} transactions`);

  // Ensure output dir exists
  mkdirSync(".output", { recursive: true });

  // Save to CSV
  writeFileSync(
    ".output/normalized-transactions.csv",
    transactionsToCsv(transactions)
  );
  console.log(`   → .output/normalized-transactions.csv`);

  // Preview
  console.log(`\n${"─".repeat(80)}`);
  console.log(`PREVIEW (first 15 transactions):`);
  console.log(`${"─".repeat(80)}`);
  console.log(
    `${"TransDate".padEnd(12)} ${"PostDate".padEnd(12)} ${"Merchant".padEnd(
      28
    )} ${"Amount".padStart(10)}`
  );
  console.log(`${"─".repeat(80)}`);

  for (const tx of transactions.slice(0, 15)) {
    const transDate = tx.transactionDate?.toISOString().split("T")[0] || "N/A";
    const postDate = tx.postedDate?.toISOString().split("T")[0] || "";
    const merchant = (tx.merchantName || "Unknown").substring(0, 26);
    const amount = tx.amount?.toFixed(2) || "0.00";
    console.log(
      `${transDate.padEnd(12)} ${postDate.padEnd(12)} ${merchant.padEnd(
        28
      )} ${amount.padStart(10)}`
    );
  }

  if (transactions.length > 15) {
    console.log(`... and ${transactions.length - 15} more`);
  }

  // Summary
  const credits = transactions.filter((tx) => (tx.amount || 0) > 0);
  const debits = transactions.filter((tx) => (tx.amount || 0) < 0);
  const totalDebits = debits.reduce(
    (sum, tx) => sum + Math.abs(tx.amount || 0),
    0
  );
  const totalCredits = credits.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  console.log(`\n${"─".repeat(80)}`);
  console.log(`SUMMARY:`);
  console.log(
    `   Debits:  ${debits.length} transactions, total: -$${totalDebits.toFixed(
      2
    )}`
  );
  console.log(
    `   Credits: ${
      credits.length
    } transactions, total: +$${totalCredits.toFixed(2)}`
  );
  console.log(`   Net:     $${(totalCredits - totalDebits).toFixed(2)}`);
  console.log(`\n✅ Done\n`);
}

main().catch(console.error);
