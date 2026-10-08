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
    // Checkout-local output and tool state (see .gitignore). Flat config lints dot-directories, and the
    // corepack cache that scripts/install-pnpm.sh writes under .sites-runtime/ holds a 13.9 MB pnpm bundle
    // that made `eslint .` run out of memory and made the error count depend on the machine.
    ".sites-runtime/**",
    ".wrangler/**",
    ".vinext/**",
    "dist/**",
    "tests/reports/**",
    "test-results/**",
    "playwright-report/**",
    "coverage/**",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
