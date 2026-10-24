import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default defineConfig([
  globalIgnores([".next/**", ".tmp/**", "public/ocr/vendor/**", "mobile/poc/android/**", "landing/v6/**", "next-env.d.ts", "coverage/**", "test-results/**", "playwright-report/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ["desktop/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  { files: ["src/**/*.{ts,tsx}"], ...reactHooks.configs.flat.recommended },
]);
