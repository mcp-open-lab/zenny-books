import { createRequire } from "module";
import nextConfig from "eslint-config-next/core-web-vitals";

const require = createRequire(import.meta.url);
const turboInvoicePlugin = require("./eslint-rules");

export default [
  ...nextConfig,
  {
    plugins: {
      "turbo-invoice": turboInvoicePlugin,
    },
    rules: {
      // Custom plugin rules
      "turbo-invoice/no-direct-devlogger": "warn",

      // Unused code
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-unused-vars": "off",
      "no-unreachable": "warn",
      "no-unreachable-loop": "warn",

      // Type safety (non-type-aware rules)
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],

      // React best practices
      "react/jsx-key": "error",
      "react/no-array-index-key": "warn",
      "react/no-unstable-nested-components": "warn",
      "react/jsx-no-leaked-render": "warn",
      "react/prop-types": "off", // TypeScript handles this

      // Common mistakes
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "eqeqeq": ["error", "smart"], // Allow == null for null/undefined checks
      "no-throw-literal": "error",
      "array-callback-return": "error",
      "prefer-const": "warn",
      "no-implicit-coercion": "warn",
      "default-case-last": "warn",
      "no-fallthrough": "warn",
    },
  },
];

