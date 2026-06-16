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

import { AppState } from "../state.js";
import engine_rest from "../api/engine_rest.jsx";
import { ReportsPage } from "./Reports.jsx";
import { create_mock_state, signal_response } from "../test/helpers.js";

const renderPage = (state) =>
  render(h(AppState.Provider, { value: state }, h(ReportsPage, {})));

const populate_reports = (state) => {
  signal_response(state.api.report.process_duration, [
    { period: 1, periodUnit: "MONTH", minimum: 1000, average: 2000, maximum: 3000 },
  ]);
  signal_response(state.api.report.task, [
    {
      taskName: "Approve invoice",
      taskDefinitionKey: "approve",
      processDefinitionId: "invoice:1",
      processDefinitionKey: "invoice",
      processDefinitionName: "Invoice",
      count: 42,
    },
  ]);
};

describe("ReportsPage", () => {
  let state;

  beforeEach(() => {
    state = create_mock_state();
  });

  afterEach(cleanup);

  it("fetches process duration and task reports on mount", () => {
    renderPage(state);

    expect(engine_rest.report.process_instance_duration).toHaveBeenCalled();
    expect(engine_rest.report.task).toHaveBeenCalled();
    expect(engine_rest.report.process_instance_duration.mock.lastCall[0]).toBe(
      state,
    );
    expect(engine_rest.report.task.mock.lastCall[0]).toBe(state);
    expect(engine_rest.report.task.mock.lastCall[1]).toMatchObject({
      reportType: "count",
      groupBy: "processDefinition",
    });
  });

  it("renders duration and completed task report rows", () => {
    populate_reports(state);

    const { getByText } = renderPage(state);

    expect(getByText("1s")).toBeTruthy();
    expect(getByText("2s")).toBeTruthy();
    expect(getByText("3s")).toBeTruthy();
    expect(getByText("Approve invoice")).toBeTruthy();
    expect(getByText("Invoice")).toBeTruthy();
    expect(getByText("42")).toBeTruthy();
  });

  it("runs the process duration report with filters", async () => {
    populate_reports(state);

    const { container, getAllByText } = renderPage(state);
    const process_section = container.querySelector(".reports > section");
    const inputs = process_section.querySelectorAll("input");
    fireEvent.input(inputs[0], { target: { value: "invoice" } });
    fireEvent.input(inputs[1], { target: { value: "2026-01-01" } });
    fireEvent.input(inputs[2], { target: { value: "2026-06-16" } });
    fireEvent.submit(getAllByText("reports.run")[0].closest("form"));

    await waitFor(() =>
      expect(engine_rest.report.process_instance_duration).toHaveBeenCalled(),
    );
    const params =
      engine_rest.report.process_instance_duration.mock.lastCall[1];
    expect(params).toMatchObject({
      processDefinitionKeyIn: "invoice",
      startedAfter: "2026-01-01T00:00:00.000+0000",
      startedBefore: "2026-06-16T23:59:59.999+0000",
    });
  });

  it("runs the task duration report with period aggregation", async () => {
    populate_reports(state);

    const { container, getAllByText } = renderPage(state);
    const task_section = container.querySelectorAll(".reports > section")[1];
    fireEvent.change(task_section.querySelector("select"), {
      target: { value: "duration" },
    });
    fireEvent.submit(getAllByText("reports.run")[1].closest("form"));

    await waitFor(() => expect(engine_rest.report.task).toHaveBeenCalled());
    expect(engine_rest.report.task.mock.lastCall[1]).toMatchObject({
      reportType: "duration",
      periodUnit: "month",
    });
  });
});
