/**
 * ESLint rule: no-direct-devlogger
 *
 * Prevents direct imports of devLogger in app/actions/* files
 * to enforce wrapper-first logging pattern.
 *
 * Use createSafeAction wrapper instead for automatic logging.
 */

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent direct devLogger imports in action files. Use createSafeAction wrapper instead.",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noDirectDevLogger:
        "Direct devLogger imports are discouraged in action files. Use createSafeAction wrapper for automatic logging instead. If you need domain-specific logging, use helper utilities.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        // Only check files in app/actions directory
        const filename = context.getFilename();
        if (!filename.includes("app/actions/")) {
          return;
        }

        // Check if importing devLogger directly
        if (node.source.value === "@/lib/dev-logger") {
          const hasDevLoggerImport = node.specifiers.some(
            (spec) =>
              spec.type === "ImportDefaultSpecifier" ||
              (spec.type === "ImportSpecifier" &&
                spec.imported.name === "devLogger")
          );

          if (hasDevLoggerImport) {
            context.report({
              node,
              messageId: "noDirectDevLogger",
            });
          }
        }
      },
    };
  },
};

module.exports = rule;

