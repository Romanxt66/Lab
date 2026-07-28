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
  ]),
  {
    rules: {
      // The lab deliberately uses effects to load data and to restore
      // browser-only state (localStorage / DOM classes) after mount, guarding
      // against hydration mismatches. React's newer `set-state-in-effect` rule
      // flags this correct, intentional pattern as an error. Keep it as a
      // warning so genuinely new cases still surface without failing lint.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
