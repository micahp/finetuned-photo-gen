import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "src/generated/**/*",
      "src/generated/prisma/**/*", 
      "node_modules/**/*",
      ".next/**/*",
      "out/**/*",
      "dist/**/*",
      "build/**/*",
      "**/__tests__/**"
    ]
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn"
    }
  },
  {
    files: ["**/__tests__/**", "**/*.test.*", "**/*.spec.*"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@next/next/no-assign-module-variable": "off"
    }
  },
  {
    files: [
      "src/app/test-*/**/*.{ts,tsx}",
      "src/app/test-contrast/**/*.{ts,tsx}",
      "src/app/test-upload/**/*.{ts,tsx}",
      "src/components/landing/**/*.{ts,tsx}"
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    files: [
      "src/app/api/**/*.{ts,tsx,js,jsx}"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
];

export default eslintConfig;
