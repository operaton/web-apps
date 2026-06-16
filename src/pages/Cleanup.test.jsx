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
import { CleanupPage } from "./Cleanup.jsx";
import { create_mock_state, signal_response } from "../test/helpers.js";

const renderPage = (state) =>
  render(h(AppState.Provider, { value: state }, h(CleanupPage, {})));

const populate_cleanup = (state) => {
  signal_response(state.api.cleanup.configuration, {
    historyCleanupEnabled: true,
    historyCleanupStrategy: "removalTimeBased",
    historyCleanupBatchWindowStartTime: "22:00",
    historyCleanupBatchWindowEndTime: "06:00",
    historyCleanupDegreeOfParallelism: 2,
  });
  signal_response(state.api.cleanup.jobs, [
    { id: "job-1", dueDate: "2026-06-16T22:00:00.000+0000", retries: 3 },
  ]);
  signal_response(state.api.cleanup.cleanable.process_definitions, [
    {
      processDefinitionId: "invoice:1",
      processDefinitionKey: "invoice",
      processDefinitionName: "Invoice",
      processDefinitionVersion: 1,
      historyTimeToLive: 30,
      finishedProcessInstanceCount: 10,
      cleanableProcessInstanceCount: 4,
    },
  ]);
  signal_response(state.api.cleanup.cleanable.decision_definitions, [
    {
      decisionDefinitionId: "decision:1",
      decisionDefinitionKey: "approval",
      decisionDefinitionName: "Approval",
      decisionDefinitionVersion: 2,
      historyTimeToLive: 7,
      finishedDecisionInstanceCount: 8,
      cleanableDecisionInstanceCount: 5,
    },
  ]);
  signal_response(state.api.cleanup.cleanable.batches, [
    {
      batchType: "instance-modification",
      historyTimeToLive: 5,
      finishedBatchCount: 6,
      cleanableBatchCount: 2,
    },
  ]);
  signal_response(state.api.cleanup.metrics.process_instances, { result: 11 });
  signal_response(state.api.cleanup.metrics.decision_instances, { result: 12 });
  signal_response(state.api.cleanup.metrics.batch_operations, { result: 13 });
};

describe("CleanupPage", () => {
  let state;

  beforeEach(() => {
    state = create_mock_state();
  });

  afterEach(cleanup);

  it("fetches cleanup status, reports, jobs, and metrics on mount", () => {
    renderPage(state);

    expect(engine_rest.cleanup.configuration.mock.lastCall[0]).toBe(state);
    expect(engine_rest.cleanup.jobs.mock.lastCall[0]).toBe(state);
    expect(
      engine_rest.cleanup.cleanable.process_definitions.mock.lastCall[0],
    ).toBe(state);
    expect(
      engine_rest.cleanup.cleanable.decision_definitions.mock.lastCall[0],
    ).toBe(state);
    expect(engine_rest.cleanup.cleanable.batches.mock.lastCall[0]).toBe(state);
    expect(engine_rest.cleanup.metrics.process_instances).toHaveBeenCalled();
    expect(engine_rest.cleanup.metrics.decision_instances).toHaveBeenCalled();
    expect(engine_rest.cleanup.metrics.batch_operations).toHaveBeenCalled();
  });

  it("renders configuration, cleanup jobs, cleanable data, and metrics", () => {
    populate_cleanup(state);

    const { getByText } = renderPage(state);

    expect(getByText("removalTimeBased")).toBeTruthy();
    expect(getByText("job-1")).toBeTruthy();
    expect(getByText("Invoice")).toBeTruthy();
    expect(getByText("Approval")).toBeTruthy();
    expect(getByText("instance-modification")).toBeTruthy();
    expect(getByText("11")).toBeTruthy();
    expect(getByText("12")).toBeTruthy();
    expect(getByText("13")).toBeTruthy();
  });

  it("updates process definition history time to live", async () => {
    populate_cleanup(state);
    engine_rest.cleanup.set_process_definition_ttl.mockResolvedValue(undefined);

    const { container, getAllByText } = renderPage(state);
    const input = container.querySelectorAll(".cleanup-ttl input")[0];
    fireEvent.input(input, { target: { value: "60" } });
    fireEvent.click(getAllByText("cleanup.save-ttl")[0]);

    await waitFor(() =>
      expect(engine_rest.cleanup.set_process_definition_ttl).toHaveBeenCalled(),
    );
    const call = engine_rest.cleanup.set_process_definition_ttl.mock.lastCall;
    expect(call[0]).toBe(state);
    expect(call[1]).toBe("invoice:1");
    expect(call[2]).toBe(60);
  });

  it("updates decision definition history time to live", async () => {
    populate_cleanup(state);
    engine_rest.cleanup.set_decision_definition_ttl.mockResolvedValue(
      undefined,
    );

    const { container, getAllByText } = renderPage(state);
    const input = container.querySelectorAll(".cleanup-ttl input")[1];
    fireEvent.input(input, { target: { value: "" } });
    fireEvent.click(getAllByText("cleanup.save-ttl")[1]);

    await waitFor(() =>
      expect(
        engine_rest.cleanup.set_decision_definition_ttl,
      ).toHaveBeenCalled(),
    );
    const call = engine_rest.cleanup.set_decision_definition_ttl.mock.lastCall;
    expect(call[0]).toBe(state);
    expect(call[1]).toBe("decision:1");
    expect(call[2]).toBeNull();
  });

  it("triggers cleanup immediately", async () => {
    populate_cleanup(state);
    engine_rest.cleanup.run.mockResolvedValue(undefined);

    const { getByText } = renderPage(state);
    fireEvent.click(getByText("cleanup.run-now"));

    await waitFor(() => expect(engine_rest.cleanup.run).toHaveBeenCalled());
    const call = engine_rest.cleanup.run.mock.lastCall;
    expect(call[0]).toBe(state);
    expect(call[1]).toBe(true);
  });
});
