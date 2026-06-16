import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { h } from "preact";
import { render, cleanup, fireEvent } from "@testing-library/preact";

// Spy all engine_rest API functions but keep RequestState/RESPONSE_STATE real.
vi.mock("../api/engine_rest.jsx", async (importOriginal) => {
  const actual = await importOriginal();
  const spyify = (o) =>
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => [
        k,
        typeof v === "function"
          ? vi.fn()
          : v && typeof v === "object"
            ? spyify(v)
            : v,
      ]),
    );
  return { ...actual, default: spyify(actual.default) };
});

// Avoid loading dmn-js in the test environment.
vi.mock("../components/DMNViewer.jsx", () => ({
  DmnViewer: ({ xml }) => h("div", { "data-testid": "dmn-viewer" }, xml),
}));

let mockParams = {};
vi.mock("preact-iso", () => ({
  useRoute: () => ({ params: mockParams }),
  useLocation: () => ({ route: vi.fn(), path: "/decisions" }),
}));

import { AppState } from "../state.js";
import engine_rest from "../api/engine_rest.jsx";
import { DecisionsPage } from "./Decisions.jsx";
import { create_mock_state, signal_response } from "../test/helpers.js";

const renderPage = (state) =>
  render(h(AppState.Provider, { value: state }, h(DecisionsPage, {})));

describe("DecisionsPage", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
    mockParams = {};
  });
  afterEach(cleanup);

  it("fetches the decision definitions on mount", () => {
    renderPage(state);
    expect(engine_rest.decision.get_decision_definitions).toHaveBeenCalled();
  });

  it("renders the decision definitions table", () => {
    signal_response(state.api.decision.definitions, [
      { id: "d1", name: "Risk", key: "risk", version: 2, versionTag: "v2" },
    ]);
    const { getByText } = renderPage(state);
    const link = getByText("Risk");
    expect(link.getAttribute("href")).toBe("/decisions/d1");
  });

  it("fetches the selected decision, DMN xml and decision instances when a decision_id is in the route", () => {
    mockParams = { decision_id: "d1" };
    renderPage(state);
    expect(engine_rest.decision.get_decision_definition).toHaveBeenCalled();
    expect(engine_rest.decision.get_dmn_xml).toHaveBeenCalled();
    expect(
      engine_rest.history.decision_instance.by_decision_definition,
    ).toHaveBeenCalled();
  });

  it("renders the DMN viewer with the fetched xml", () => {
    mockParams = { decision_id: "d1" };
    signal_response(state.api.decision.definition, {
      id: "d1",
      key: "risk",
      name: "Risk",
      version: 1,
    });
    signal_response(state.api.decision.dmn, { dmnXml: "<dmn>xml</dmn>" });
    const { getByTestId } = renderPage(state);
    expect(getByTestId("dmn-viewer").textContent).toBe("<dmn>xml</dmn>");
  });

  it("renders decision instances for the selected decision", () => {
    mockParams = { decision_id: "d1" };
    signal_response(state.api.decision.definition, {
      id: "d1",
      key: "risk",
      name: "Risk",
      version: 1,
    });
    signal_response(state.api.decision.dmn, { dmnXml: "<dmn>xml</dmn>" });
    signal_response(state.api.history.decision_instance.list, [
      {
        id: "decision-instance-1",
        evaluationTime: "2024-01-01T10:00:00Z",
        processDefinitionId: "proc:1",
        processInstanceId: "abcdef1234567890",
        activityId: "BusinessRuleTask_1",
        tenantId: "tenant-a",
      },
    ]);

    const { getByText } = renderPage(state);
    expect(getByText("decision")).toBeTruthy();
    const process = getByText("abcdef12");
    expect(process.getAttribute("href")).toBe(
      "/processes/proc:1/instances/abcdef1234567890/vars?history=true",
    );
    expect(getByText("BusinessRuleTask_1")).toBeTruthy();
    expect(getByText("tenant-a")).toBeTruthy();
  });

  it("loads more decision instances from the current result length", () => {
    mockParams = { decision_id: "d1" };
    signal_response(state.api.decision.definition, {
      id: "d1",
      key: "risk",
      name: "Risk",
      version: 1,
    });
    signal_response(state.api.decision.dmn, { dmnXml: "<dmn>xml</dmn>" });
    signal_response(state.api.history.decision_instance.list, [
      { id: "di-1", evaluationTime: "2024-01-01T10:00:00Z" },
      { id: "di-2", evaluationTime: "2024-01-02T10:00:00Z" },
    ]);
    state.api.history.decision_instance.list.value = {
      ...state.api.history.decision_instance.list.value,
      hasMore: true,
    };

    const { getByText } = renderPage(state);
    fireEvent.click(getByText("tasks.load-more"));
    expect(
      engine_rest.history.decision_instance.by_decision_definition.mock
        .lastCall[2],
    ).toBe(2);
  });
});
