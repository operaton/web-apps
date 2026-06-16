import { GET, POST, PUT } from "../helper.jsx";

const metric_url = (name, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return `/metrics/${name}/sum${query ? `?${query}` : ""}`;
};

const get_configuration = (state) =>
  GET("/history/cleanup/configuration", state, state.api.cleanup.configuration);

const get_jobs = (state) =>
  GET("/history/cleanup/jobs", state, state.api.cleanup.jobs);

const run_cleanup = (state, immediately_due = false) =>
  POST(
    `/history/cleanup?immediatelyDue=${immediately_due}`,
    {},
    state,
    state.api.cleanup.run,
  );

const get_cleanable_process_definitions = (state) =>
  GET(
    "/history/process-definition/cleanable-process-instance-report",
    state,
    state.api.cleanup.cleanable.process_definitions,
  );

const get_cleanable_decision_definitions = (state) =>
  GET(
    "/history/decision-definition/cleanable-decision-instance-report",
    state,
    state.api.cleanup.cleanable.decision_definitions,
  );

const get_cleanable_batches = (state) =>
  GET(
    "/history/batch/cleanable-batch-report",
    state,
    state.api.cleanup.cleanable.batches,
  );

const get_removed_process_instances = (state, params = {}) =>
  GET(
    metric_url("history-cleanup-removed-process-instances", params),
    state,
    state.api.cleanup.metrics.process_instances,
  );

const get_removed_decision_instances = (state, params = {}) =>
  GET(
    metric_url("history-cleanup-removed-decision-instances", params),
    state,
    state.api.cleanup.metrics.decision_instances,
  );

const get_removed_batch_operations = (state, params = {}) =>
  GET(
    metric_url("history-cleanup-removed-batch-operations", params),
    state,
    state.api.cleanup.metrics.batch_operations,
  );

const set_process_definition_ttl = (state, id, historyTimeToLive) =>
  PUT(
    `/process-definition/${id}/history-time-to-live`,
    { historyTimeToLive },
    state,
    state.api.cleanup.update_ttl,
  );

const set_decision_definition_ttl = (state, id, historyTimeToLive) =>
  PUT(
    `/decision-definition/${id}/history-time-to-live`,
    { historyTimeToLive },
    state,
    state.api.cleanup.update_ttl,
  );

const cleanup = {
  configuration: get_configuration,
  jobs: get_jobs,
  run: run_cleanup,
  cleanable: {
    process_definitions: get_cleanable_process_definitions,
    decision_definitions: get_cleanable_decision_definitions,
    batches: get_cleanable_batches,
  },
  metrics: {
    process_instances: get_removed_process_instances,
    decision_instances: get_removed_decision_instances,
    batch_operations: get_removed_batch_operations,
  },
  set_process_definition_ttl,
  set_decision_definition_ttl,
};

export default cleanup;
