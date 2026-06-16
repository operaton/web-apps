import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { h } from "preact";
import { render, cleanup } from "@testing-library/preact";

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

vi.mock("../components/BPMNViewer.jsx", () => ({
  BPMNViewer: ({ xml }) => h("div", { "data-testid": "bpmn-viewer" }, xml),
}));
vi.mock("../components/CamundaForm.jsx", () => ({
  CamundaForm: ({ schema }) =>
    h("div", { "data-testid": "camunda-form" }, JSON.stringify(schema)),
}));
vi.mock("./StartProcessList.jsx", () => ({
  StartProcessList: () =>
    h("div", { "data-testid": "start-process-list" }, "start"),
}));

let mockQuery = {};
const routeFn = vi.fn();
vi.mock("preact-iso", () => ({
  useRoute: () => ({ params: {}, query: mockQuery }),
  useLocation: () => ({ route: routeFn, path: "/tasks-dashboard" }),
}));

import { AppState } from "../state.js";
import engine_rest from "../api/engine_rest.jsx";
import { TaskDashboardPage } from "./TaskDashboard.jsx";
import { create_mock_state, signal_response } from "../test/helpers.js";

const renderPage = (state) =>
  render(h(AppState.Provider, { value: state }, h(TaskDashboardPage, {})));

describe("TaskDashboardPage", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
    mockQuery = {};
    routeFn.mockClear();
  });
  afterEach(cleanup);

  it("loads task filters, groups, the summary and the first result page", () => {
    renderPage(state);
    expect(engine_rest.filter.get_filters).toHaveBeenCalled();
    expect(engine_rest.group.all).toHaveBeenCalled();
    expect(engine_rest.task.get_task_dashboard_summary).toHaveBeenCalled();
    expect(engine_rest.task.get_task_dashboard_results).toHaveBeenCalled();
  });

  it("renders assignment counts and group distribution links", () => {
    signal_response(state.api.task.dashboard.summary, {
      total: 9,
      assigned: 4,
      unassigned: 5,
      groups: [{ id: "sales", name: "Sales", count: 3 }],
    });

    const { getByText } = renderPage(state);
    expect(
      getByText("task_dashboard.summary.open").closest("a").href,
    ).toContain("/tasks-dashboard");
    expect(
      getByText("task_dashboard.summary.assigned").closest("a").href,
    ).toContain("q.assigned=true");
    const group_link = getByText("3").closest("a");
    expect(group_link.getAttribute("href")).toContain("q.candidateGroup=sales");
    expect(group_link.getAttribute("href")).toContain(
      "q.includeAssignedTasks=true",
    );
  });

  it("renders task search results with task and process links", () => {
    signal_response(state.api.filter.list, []);
    signal_response(state.api.task.dashboard.results, [
      {
        id: "t1",
        name: "Approve invoice",
        assignee: "demo",
        processDefinitionId: "pd1",
        definitionName: "Invoice",
      },
    ]);

    const { getByText } = renderPage(state);
    expect(getByText("Approve invoice").getAttribute("href")).toBe(
      "/tasks/t1/form",
    );
    expect(getByText("Invoice").getAttribute("href")).toBe("/processes/pd1");
    expect(getByText("demo")).toBeTruthy();
  });
});
