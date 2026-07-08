import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { h } from "preact";
import { render, cleanup } from "@testing-library/preact";

// The sub-nav reads the selected definition + history flag from the route.
let mock_params = {};
vi.mock("preact-iso", () => ({
  useRoute: () => ({ params: mock_params, query: {}, path: "/processes" }),
  useLocation: () => ({ route: vi.fn() }),
}));

import { AppState } from "../state.js";
import { ProcessSubNav } from "./Processes.jsx";
import { create_mock_state } from "../test/helpers.js";
import { register, _reset_registry } from "../plugins/registry.js";
import { PLUGIN_POINTS } from "../plugins/points.js";
import { plugin_apis } from "../api/plugins.js";

const renderSubNav = (state) =>
  render(h(AppState.Provider, { value: state }, h(ProcessSubNav, {})));

beforeEach(() => {
  _reset_registry();
  for (const key of Object.keys(plugin_apis)) delete plugin_apis[key];
  mock_params = { definition_id: "def:1" };
});
afterEach(() => {
  cleanup();
  _reset_registry();
});

describe("Processes sub-nav — plugin definition tabs", () => {
  it("renders a nav link for a PROCESS_DEFINITION_TAB plugin alongside the built-ins", () => {
    register({
      id: "metrics.heat",
      point: PLUGIN_POINTS.PROCESS_DEFINITION_TAB,
      properties: { id: "heat", nameKey: "plugins.metrics.tab-heat" },
      Component: () => null,
    });

    const { container } = renderSubNav(create_mock_state());
    const hrefs = Array.from(container.querySelectorAll("menu a")).map((a) =>
      a.getAttribute("href"),
    );
    // Built-in panels are still there…
    expect(hrefs).toContain("/processes/def:1/instances");
    // …and the plugin tab now has its own reachable link (label = i18n key).
    const heat = container.querySelector('a[href="/processes/def:1/heat"]');
    expect(heat).toBeTruthy();
    expect(heat.textContent).toContain("plugins.metrics.tab-heat");
  });

  it("renders no plugin nav entry when none is registered", () => {
    const { container } = renderSubNav(create_mock_state());
    expect(
      container.querySelector('a[href="/processes/def:1/heat"]'),
    ).toBeNull();
  });
});
