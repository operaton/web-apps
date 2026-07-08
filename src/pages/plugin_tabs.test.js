/**
 * Integration coverage for the page-level plugin tab merge. Unlike
 * registry.test.js (which exercises `plugin_tabs` against synthetic bases),
 * this drives the real memoized `task_tabs()` / `process_definition_tabs()` the
 * pages call, against their real built-in tab arrays — proving a registered
 * plugin tab actually lands in the page's tab set with contiguous `pos`.
 *
 * Each memoized function is called exactly once per test so the module-scope
 * cache doesn't cross-contaminate (vitest isolates modules per file).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { register, _reset_registry } from "../plugins/registry.js";
import { PLUGIN_POINTS } from "../plugins/points.js";
import { plugin_apis } from "../api/plugins.js";
import { task_tabs } from "./Tasks.jsx";
import { process_definition_tabs } from "./Processes.jsx";

beforeEach(() => {
  _reset_registry();
  for (const key of Object.keys(plugin_apis)) delete plugin_apis[key];
});

describe("pages — plugin tab merge", () => {
  it("appends a low-priority TASK_TAB plugin after the built-in task tabs", () => {
    register({
      id: "task-extra",
      point: PLUGIN_POINTS.TASK_TAB,
      priority: -10,
      properties: { id: "extra", nameKey: "plugins.extra.tab" },
      Component: () => null,
    });

    const tabs = task_tabs();
    expect(tabs.map((tab) => tab.id)).toEqual([
      "form",
      "history",
      "attachments",
      "diagram",
      "extra",
    ]);
    // pos is recomputed contiguous — Tabs.jsx arrow-key nav indexes by it.
    expect(tabs.map((tab) => tab.pos)).toEqual([0, 1, 2, 3, 4]);
  });

  it("prepends a positive-priority PROCESS_DEFINITION_TAB before the built-ins", () => {
    register({
      id: "proc-extra",
      point: PLUGIN_POINTS.PROCESS_DEFINITION_TAB,
      priority: 5,
      properties: { id: "first", nameKey: "plugins.first.tab" },
      Component: () => null,
    });

    const tabs = process_definition_tabs();
    expect(tabs.map((tab) => tab.id)).toEqual([
      "first",
      "instances",
      "incidents",
      "called_definitions",
      "jobs",
    ]);
    expect(tabs.map((tab) => tab.pos)).toEqual([0, 1, 2, 3, 4]);
  });
});
