import preact from "eslint-config-preact";

/**
 * Flat config (ESLint 9+). Replaces the old `eslintConfig` key in package.json.
 *
 * eslint-config-preact ships as a flat-config array, but its entries carry no
 * `files`, so they would only apply to the default `.js`/`.mjs`/`.cjs` set —
 * every `.jsx` component would go unlinted. Re-targeting each entry at both
 * extensions is what makes `npm run lint` cover the whole source tree.
 */
export default [
  {
    ignores: [
      "dist/**",
      "test-results/**",
      "playwright-report/**",
      // Standalone Node scripts for the local load-test fixtures, not app code.
      "dev-fixtures/**",
    ],
  },
  ...preact.map((config) => ({ ...config, files: ["**/*.js", "**/*.jsx"] })),
  {
    // Playwright fixtures take a `use` callback, which the React Hooks rule
    // mistakes for a hook call.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];
