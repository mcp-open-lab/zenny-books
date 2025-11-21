#!/usr/bin/env node

/**
 * Check for direct devLogger imports in action files
 * This enforces the wrapper-first logging pattern
 */

const fs = require("fs");
const path = require("path");

const actionsDir = path.join(process.cwd(), "app/actions");
const violations = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relativePath = path.relative(process.cwd(), filePath);

  // Check for direct devLogger import
  if (
    content.includes('from "@/lib/dev-logger"') ||
    content.includes('from "@/lib/dev-logger";')
  ) {
    // Allow exceptions if file has domain-specific logging comment
    const hasExceptionComment =
      content.includes("domain-specific logging") ||
      content.includes("Domain-specific logging") ||
      content.includes("eslint-disable-next-line turbo-invoice/no-direct-devlogger");

    if (!hasExceptionComment) {
      violations.push({
        file: relativePath,
        message:
          "Direct devLogger import found. Use createSafeAction wrapper instead. If this is domain-specific logging, add a comment: '// Domain-specific logging'",
      });
    }
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      checkFile(filePath);
    }
  }
}

walkDir(actionsDir);

if (violations.length > 0) {
  console.error("\n❌ Logging pattern violations found:\n");
  violations.forEach(({ file, message }) => {
    console.error(`  ${file}: ${message}`);
  });
  console.error(
    "\n💡 Use createSafeAction wrapper for automatic logging instead.\n"
  );
  process.exit(1);
} else {
  console.log("✅ No logging pattern violations found.");
  process.exit(0);
}

