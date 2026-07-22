import { test } from "./fixtures.js";
import { expect_no_a11y_violations } from "./a11y.js";

// Automated WCAG 2.x A/AA scans (axe-core) on each top-level page. The page
// fixture is pre-authenticated (see fixtures.js) and the Vite dev server is
// started by Playwright; the Operaton backend must be up on :8084 for the
// authenticated pages to render real content (`docker compose up`).

const ROUTES = [
  { path: "/", name: "dashboard" },
  { path: "/tasks", name: "tasks" },
  { path: "/processes", name: "processes" },
  { path: "/decisions", name: "decisions" },
  { path: "/deployments", name: "deployments" },
  { path: "/batches", name: "batches" },
  { path: "/migrations", name: "migrations" },
  { path: "/account", name: "account" },
  { path: "/admin", name: "admin" },
  { path: "/help", name: "help" },
  { path: "/does-not-exist", name: "not-found" },
];

test.describe("accessibility (axe)", () => {
  for (const { path, name } of ROUTES) {
    test(`${name} (${path}) has no WCAG A/AA violations`, async ({ page }) => {
      // The Vite dev server compiles heavy routes on demand; under parallel
      // cold-start the first render can be slow, so allow generous headroom.
      test.setTimeout(60_000);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      // Every page renders a <main> landmark (the skip-link target).
      await page.locator("main").first().waitFor({ timeout: 30_000 });
      await expect_no_a11y_violations(page);
    });
  }

  test("start-process page has no violations", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/tasks/start", { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor({ timeout: 30_000 });
    await expect_no_a11y_violations(page);
  });
});
