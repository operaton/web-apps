import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { h } from "preact";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/preact";

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

const route = vi.fn();
let mockQuery = {};

vi.mock("preact-iso", () => ({
  useRoute: () => ({ query: mockQuery }),
  useLocation: () => ({ route, path: "/operation-log" }),
}));

import { AppState } from "../state.js";
import engine_rest from "../api/engine_rest.jsx";
import { OperationLogPage } from "./OperationLog.jsx";
import { create_mock_state, signal_response } from "../test/helpers.js";

const renderPage = (state) =>
  render(h(AppState.Provider, { value: state }, h(OperationLogPage, {})));

const sample_entries = [
  {
    id: "entry-1",
    operationId: "operation-1",
    timestamp: "2026-06-01T10:15:00.000+0000",
    userId: "demo",
    operationType: "ModifyProcessInstance",
    entityType: "ProcessInstance",
    category: "Operator",
    property: "nrOfInstances",
    orgValue: "1",
    newValue: "2",
    processDefinitionId: "invoice:1",
    processInstanceId: "pi-1",
    annotation: "Reviewed",
  },
  {
    id: "entry-2",
    operationId: "operation-1",
    timestamp: "2026-06-01T10:15:00.000+0000",
    userId: "demo",
    operationType: "ModifyProcessInstance",
    entityType: "Task",
    category: "Operator",
    property: "assignee",
    orgValue: "sales",
    newValue: "ops",
    taskId: "task-1",
  },
];

describe("OperationLogPage", () => {
  let state;

  beforeEach(() => {
    state = create_mock_state();
    mockQuery = {};
    route.mockClear();
  });

  afterEach(cleanup);

  it("fetches operation log entries and their count on mount", () => {
    renderPage(state);
    const all_call = engine_rest.history.operation_log.all.mock.lastCall,
      count_call = engine_rest.history.operation_log.count.mock.lastCall;

    expect(all_call[0]).toBe(state);
    expect(all_call[1]).toEqual({});
    expect(all_call[2]).toBe(0);
    expect(count_call[0]).toBe(state);
    expect(count_call[1]).toEqual({});
  });

  it("translates list query filters into operation-log API parameters", () => {
    mockQuery = {
      "q.userId": "demo",
      "q.timestampAfter": "2026-06-01T10:30",
      "q.timestampBefore": "2026-06-01T10:30:45",
      sortBy: "userId",
      sortOrder: "asc",
    };

    renderPage(state);

    const [called_state, params, first_result] =
      engine_rest.history.operation_log.all.mock.lastCall;

    expect(called_state).toBe(state);
    expect(params).toEqual({
      userId: "demo",
      timestampAfter: "2026-06-01T10:30:00.000+0000",
      timestampBefore: "2026-06-01T10:30:45.000+0000",
      sortBy: "userId",
      sortOrder: "asc",
    });
    expect(first_result).toBe(0);
  });

  it("renders grouped operation rows and their details", () => {
    signal_response(state.api.history.operation_log.list, sample_entries);
    signal_response(state.api.history.operation_log.count, { count: 2 });

    const { getByText, container } = renderPage(state);

    expect(getByText("ModifyProcessInstance")).toBeTruthy();
    expect(getByText("Reviewed")).toBeTruthy();
    expect(getByText("nrOfInstances")).toBeTruthy();
    expect(getByText("assignee")).toBeTruthy();
    expect(
      container.querySelector(
        '.operation-log-entities a[href="/processes/invoice:1/instances/pi-1/vars?history=true"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(
        '.operation-log-entities a[href="/tasks/task-1/form"]',
      ),
    ).toBeTruthy();
  });

  it("sets an annotation for an operation group", async () => {
    signal_response(state.api.history.operation_log.list, sample_entries);
    engine_rest.history.operation_log.set_annotation.mockResolvedValue(
      undefined,
    );

    const { getByText, container } = renderPage(state);

    fireEvent.click(getByText("operation_log.annotate"));
    fireEvent.input(container.querySelector("textarea"), {
      target: { value: "Checked by ops" },
    });
    fireEvent.click(getByText("common.save"));

    await waitFor(() =>
      expect(
        engine_rest.history.operation_log.set_annotation,
      ).toHaveBeenCalled(),
    );
    const call = engine_rest.history.operation_log.set_annotation.mock.lastCall;
    expect(call[0]).toBe(state);
    expect(call[1]).toBe("operation-1");
    expect(call[2]).toBe("Checked by ops");
  });

  it("clears an annotation for an operation group", async () => {
    signal_response(state.api.history.operation_log.list, sample_entries);
    engine_rest.history.operation_log.clear_annotation.mockResolvedValue(
      undefined,
    );

    const { getByText } = renderPage(state);

    fireEvent.click(getByText("operation_log.annotate"));
    fireEvent.click(getByText("operation_log.clear-annotation"));

    await waitFor(() =>
      expect(
        engine_rest.history.operation_log.clear_annotation,
      ).toHaveBeenCalled(),
    );
    const call =
      engine_rest.history.operation_log.clear_annotation.mock.lastCall;
    expect(call[0]).toBe(state);
    expect(call[1]).toBe("operation-1");
  });
});
