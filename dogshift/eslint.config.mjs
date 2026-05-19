import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Community-vendored Claude skills (UI UX Pro Max, stop-slop, etc).
    // Not DogShift code, not maintained here — their scripts/.cjs files
    // would otherwise trip @typescript-eslint/no-require-imports.
    ".claude/skills/**",
  ]),
]);

export default eslintConfig;
