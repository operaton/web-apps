import { describe, it, vi, beforeEach } from "vitest";

vi.mock("../helper.jsx", () => ({
  GET: vi.fn(),
}));

import { GET } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import report from "./report.js";

describe("api/resources/report", () => {
  let state;

  beforeEach(() => {
    state = create_mock_state();
  });

  it("process_instance_duration() GETs the duration report with defaults", () => {
    report.process_instance_duration(state);
    expect_api_call(GET, {
      url: "/history/process-instance/report?reportType=duration&periodUnit=month",
      state,
      signal: state.api.report.process_duration,
    });
  });

  it("process_instance_duration() appends filters", () => {
    report.process_instance_duration(state, {
      periodUnit: "quarter",
      processDefinitionKeyIn: "invoice",
      startedAfter: "2026-01-01T00:00:00.000+0000",
      startedBefore: "2026-12-31T23:59:59.999+0000",
    });
    expect_api_call(GET, {
      url: "/history/process-instance/report?reportType=duration&periodUnit=quarter&processDefinitionKeyIn=invoice&startedAfter=2026-01-01T00%3A00%3A00.000%2B0000&startedBefore=2026-12-31T23%3A59%3A59.999%2B0000",
      state,
      signal: state.api.report.process_duration,
    });
  });

  it("task() GETs the historic task count report", () => {
    report.task(state, {
      reportType: "count",
      groupBy: "processDefinition",
      completedAfter: "2026-01-01T00:00:00.000+0000",
    });
    expect_api_call(GET, {
      url: "/history/task/report?reportType=count&groupBy=processDefinition&completedAfter=2026-01-01T00%3A00%3A00.000%2B0000",
      state,
      signal: state.api.report.task,
    });
  });

  it("task() GETs the historic task duration report", () => {
    report.task(state, {
      reportType: "duration",
      periodUnit: "quarter",
    });
    expect_api_call(GET, {
      url: "/history/task/report?reportType=duration&periodUnit=quarter",
      state,
      signal: state.api.report.task,
    });
  });
});
