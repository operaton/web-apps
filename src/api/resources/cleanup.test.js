import { describe, it, vi, beforeEach } from "vitest";

vi.mock("../helper.jsx", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
}));

import { GET, POST, PUT } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import cleanup from "./cleanup.js";

describe("api/resources/cleanup", () => {
  let state;

  beforeEach(() => {
    state = create_mock_state();
  });

  it("configuration() GETs history cleanup configuration", () => {
    cleanup.configuration(state);
    expect_api_call(GET, {
      url: "/history/cleanup/configuration",
      state,
      signal: state.api.cleanup.configuration,
    });
  });

  it("jobs() GETs history cleanup jobs", () => {
    cleanup.jobs(state);
    expect_api_call(GET, {
      url: "/history/cleanup/jobs",
      state,
      signal: state.api.cleanup.jobs,
    });
  });

  it("run() POSTs the cleanup trigger", () => {
    cleanup.run(state, true);
    expect_api_call(POST, {
      url: "/history/cleanup?immediatelyDue=true",
      body: {},
      state,
      signal: state.api.cleanup.run,
    });
  });

  it("cleanable.process_definitions() GETs the cleanable process report", () => {
    cleanup.cleanable.process_definitions(state);
    expect_api_call(GET, {
      url: "/history/process-definition/cleanable-process-instance-report",
      state,
      signal: state.api.cleanup.cleanable.process_definitions,
    });
  });

  it("cleanable.decision_definitions() GETs the cleanable decision report", () => {
    cleanup.cleanable.decision_definitions(state);
    expect_api_call(GET, {
      url: "/history/decision-definition/cleanable-decision-instance-report",
      state,
      signal: state.api.cleanup.cleanable.decision_definitions,
    });
  });

  it("cleanable.batches() GETs the cleanable batch report", () => {
    cleanup.cleanable.batches(state);
    expect_api_call(GET, {
      url: "/history/batch/cleanable-batch-report",
      state,
      signal: state.api.cleanup.cleanable.batches,
    });
  });

  it("metrics.process_instances() GETs the metric sum", () => {
    cleanup.metrics.process_instances(state, {
      startDate: "2026-05-17T00:00:00.000+0000",
      endDate: "2026-06-16T00:00:00.000+0000",
    });
    expect_api_call(GET, {
      url: "/metrics/history-cleanup-removed-process-instances/sum?startDate=2026-05-17T00%3A00%3A00.000%2B0000&endDate=2026-06-16T00%3A00%3A00.000%2B0000",
      state,
      signal: state.api.cleanup.metrics.process_instances,
    });
  });

  it("metrics.decision_instances() GETs the metric sum", () => {
    cleanup.metrics.decision_instances(state);
    expect_api_call(GET, {
      url: "/metrics/history-cleanup-removed-decision-instances/sum",
      state,
      signal: state.api.cleanup.metrics.decision_instances,
    });
  });

  it("metrics.batch_operations() GETs the metric sum", () => {
    cleanup.metrics.batch_operations(state);
    expect_api_call(GET, {
      url: "/metrics/history-cleanup-removed-batch-operations/sum",
      state,
      signal: state.api.cleanup.metrics.batch_operations,
    });
  });

  it("set_process_definition_ttl() PUTs historyTimeToLive", () => {
    cleanup.set_process_definition_ttl(state, "process:1", 30);
    expect_api_call(PUT, {
      url: "/process-definition/process:1/history-time-to-live",
      body: { historyTimeToLive: 30 },
      state,
      signal: state.api.cleanup.update_ttl,
    });
  });

  it("set_decision_definition_ttl() PUTs nullable historyTimeToLive", () => {
    cleanup.set_decision_definition_ttl(state, "decision:1", null);
    expect_api_call(PUT, {
      url: "/decision-definition/decision:1/history-time-to-live",
      body: { historyTimeToLive: null },
      state,
      signal: state.api.cleanup.update_ttl,
    });
  });
});
