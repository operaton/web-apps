import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/preact";
import descriptors from "./plugin.jsx";
import { register, _reset_registry } from "../../registry.js";
import { PLUGIN_POINTS } from "../../points.js";
import engine_rest from "../../../api/engine_rest.jsx";
import { plugin_apis } from "../../../api/plugins.js";
import { render_with_state } from "../../../test/render.jsx";
import { create_mock_state, signal_response } from "../../../test/helpers.js";

const [page_descriptor, tab_descriptor] = descriptors;
const MetricsPage = page_descriptor.Component;
const DefinitionHeatTab = tab_descriptor.Component;

// The heat tab reads useRoute().params.definition_id — make it addressable.
let mock_params = {};
vi.mock("preact-iso", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useRoute: () => ({ params: mock_params, query: {} }) };
});

beforeEach(() => {
  _reset_registry();
  for (const key of Object.keys(plugin_apis)) delete plugin_apis[key];
  mock_params = {};
  register(page_descriptor);
  register(tab_descriptor);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Engine Metrics plugin — descriptors", () => {
  it("declares a PAGE and a PROCESS_DEFINITION_TAB", () => {
    expect(page_descriptor.point).toBe(PLUGIN_POINTS.PAGE);
    expect(page_descriptor.properties.href).toBe("/plugin/metrics");
    expect(tab_descriptor.point).toBe(PLUGIN_POINTS.PROCESS_DEFINITION_TAB);
    expect(tab_descriptor.properties.id).toBe("heat");
  });
});

describe("Engine Metrics plugin — page", () => {
  it("requests metrics on mount and renders the engine version", () => {
    const state = create_mock_state();
    // Stub the mounted API so mounting makes no network calls.
    vi.spyOn(engine_rest.plugins.metrics, "version").mockImplementation(
      () => {},
    );
    vi.spyOn(engine_rest.plugins.metrics, "process_starts").mockImplementation(
      () => {},
    );
    vi.spyOn(engine_rest.plugins.metrics, "flow_nodes").mockImplementation(
      () => {},
    );
    signal_response(state.api.plugins.metrics.version, { version: "7.99.0" });

    render_with_state(<MetricsPage />, { state });

    // Compare by reference — structurally matching `state` would recurse into
    // the signal tree and throw (see helpers.js expect_api_call).
    expect(engine_rest.plugins.metrics.version).toHaveBeenCalled();
    expect(engine_rest.plugins.metrics.version.mock.lastCall[0]).toBe(state);
    expect(screen.getByText("7.99.0")).toBeTruthy();
  });
});

describe("Engine Metrics plugin — definition heat tab", () => {
  it("fetches statistics for the routed definition and renders a row", async () => {
    mock_params = { definition_id: "def:1" };
    const stats = [
      {
        id: "task_a",
        instances: 3,
        incidents: [{ incidentType: "failedJob", incidentCount: 2 }],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => stats })),
    );

    render_with_state(<DefinitionHeatTab />, { state: create_mock_state() });

    // the row renders once the (stubbed) statistics request resolves
    expect(await screen.findByText("task_a")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();

    const call = globalThis.fetch.mock.calls[0][0];
    expect(call).toContain(
      "/process-definition/def:1/statistics?incidents=true",
    );
  });
});
