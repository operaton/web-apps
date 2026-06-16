import { useSignal } from "@preact/signals";
import { useContext, useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";
import engine_rest, { RequestState } from "../api/engine_rest.jsx";
import { AppState } from "../state.js";

const METRIC_WINDOW_DAYS = 30;

const camunda_date = (date) => date.toISOString().replace("Z", "+0000");

const metric_params = () => {
  const end = new Date(),
    start = new Date(end);
  start.setDate(start.getDate() - METRIC_WINDOW_DAYS);
  return {
    startDate: camunda_date(start),
    endDate: camunda_date(end),
  };
};

const load_cleanup = (state) => {
  const params = metric_params();
  void engine_rest.cleanup.configuration(state);
  void engine_rest.cleanup.jobs(state);
  void engine_rest.cleanup.cleanable.process_definitions(state);
  void engine_rest.cleanup.cleanable.decision_definitions(state);
  void engine_rest.cleanup.cleanable.batches(state);
  void engine_rest.cleanup.metrics.process_instances(state, params);
  void engine_rest.cleanup.metrics.decision_instances(state, params);
  void engine_rest.cleanup.metrics.batch_operations(state, params);
};

const num = (value) => (value ?? 0).toLocaleString();

const nullable = (value) => value ?? "—";

const metric_value = (signal) => signal.value?.data?.result ?? 0;

const CleanupPage = () => {
  const state = useContext(AppState),
    [t] = useTranslation();

  useEffect(() => {
    load_cleanup(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run_cleanup = async () => {
    await engine_rest.cleanup.run(state, true);
    load_cleanup(state);
  };

  return (
    <main id="content" class="cleanup fade-in">
      <header>
        <div>
          <h1>{t("cleanup.title")}</h1>
          <p>{t("cleanup.subtitle")}</p>
        </div>
        <div class="button-group">
          <button
            type="button"
            class="secondary"
            onClick={() => load_cleanup(state)}
          >
            {t("cleanup.refresh")}
          </button>
          <button type="button" onClick={run_cleanup}>
            {t("cleanup.run-now")}
          </button>
        </div>
      </header>

      <ConfigurationPanel />
      <MetricsPanel />
      <CleanupJobs />
      <CleanableData />
    </main>
  );
};

const ConfigurationPanel = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    signal = state.api.cleanup.configuration;

  return (
    <section>
      <h2>{t("cleanup.configuration")}</h2>
      <RequestState
        signal={signal}
        on_success={() => {
          const config = signal.value.data;
          return (
            <dl class="cleanup-summary">
              <dt>{t("cleanup.enabled")}</dt>
              <dd>
                {config.historyCleanupEnabled
                  ? t("common.yes")
                  : t("common.no")}
              </dd>
              <dt>{t("cleanup.strategy")}</dt>
              <dd>{nullable(config.historyCleanupStrategy)}</dd>
              <dt>{t("cleanup.batch-window")}</dt>
              <dd>
                {nullable(config.historyCleanupBatchWindowStartTime)} -{" "}
                {nullable(config.historyCleanupBatchWindowEndTime)}
              </dd>
              <dt>{t("cleanup.parallelism")}</dt>
              <dd>{nullable(config.historyCleanupDegreeOfParallelism)}</dd>
            </dl>
          );
        }}
      />
    </section>
  );
};

const MetricsPanel = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    metrics = state.api.cleanup.metrics;

  return (
    <section>
      <h2>{t("cleanup.deleted-data", { days: METRIC_WINDOW_DAYS })}</h2>
      <RequestState
        signal={[
          metrics.process_instances,
          metrics.decision_instances,
          metrics.batch_operations,
        ]}
        on_success={() => (
          <dl class="cleanup-metrics">
            <dt>{t("cleanup.metrics.process-instances")}</dt>
            <dd>{num(metric_value(metrics.process_instances))}</dd>
            <dt>{t("cleanup.metrics.decision-instances")}</dt>
            <dd>{num(metric_value(metrics.decision_instances))}</dd>
            <dt>{t("cleanup.metrics.batch-operations")}</dt>
            <dd>{num(metric_value(metrics.batch_operations))}</dd>
          </dl>
        )}
      />
    </section>
  );
};

const CleanupJobs = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    signal = state.api.cleanup.jobs;

  return (
    <section>
      <h2>{t("cleanup.jobs")}</h2>
      <RequestState
        signal={signal}
        on_success={() => {
          const jobs = signal.value.data ?? [];
          if (jobs.length === 0)
            return <p class="info-box">{t("cleanup.no-jobs")}</p>;
          return (
            <table>
              <thead>
                <tr>
                  <th>{t("common.id")}</th>
                  <th>{t("cleanup.due-date")}</th>
                  <th>{t("cleanup.retries")}</th>
                  <th>{t("cleanup.exception")}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <th scope="row">{job.id}</th>
                    <td>{nullable(job.dueDate)}</td>
                    <td>{nullable(job.retries)}</td>
                    <td>{nullable(job.exceptionMessage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }}
      />
    </section>
  );
};

const CleanableData = () => (
  <section>
    <CleanableProcessDefinitions />
    <CleanableDecisionDefinitions />
    <CleanableBatches />
  </section>
);

const CleanableProcessDefinitions = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    signal = state.api.cleanup.cleanable.process_definitions;

  return (
    <section>
      <h2>{t("cleanup.process-definitions")}</h2>
      <RequestState
        signal={signal}
        on_success={() => {
          const rows = signal.value.data ?? [];
          if (rows.length === 0)
            return <p class="info-box">{t("cleanup.no-cleanable-data")}</p>;
          return (
            <table>
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("common.key")}</th>
                  <th>{t("cleanup.version")}</th>
                  <th>{t("cleanup.finished")}</th>
                  <th>{t("cleanup.cleanable")}</th>
                  <th>{t("cleanup.ttl")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.processDefinitionId}>
                    <th scope="row">
                      <a href={`/processes/${row.processDefinitionId}`}>
                        {row.processDefinitionName ??
                          row.processDefinitionKey ??
                          row.processDefinitionId}
                      </a>
                    </th>
                    <td>{row.processDefinitionKey}</td>
                    <td>{row.processDefinitionVersion}</td>
                    <td>{num(row.finishedProcessInstanceCount)}</td>
                    <td>{num(row.cleanableProcessInstanceCount)}</td>
                    <td>
                      <TtlEditor
                        id={row.processDefinitionId}
                        value={row.historyTimeToLive}
                        on_save={(id, ttl) =>
                          engine_rest.cleanup.set_process_definition_ttl(
                            state,
                            id,
                            ttl,
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }}
      />
    </section>
  );
};

const CleanableDecisionDefinitions = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    signal = state.api.cleanup.cleanable.decision_definitions;

  return (
    <section>
      <h2>{t("cleanup.decision-definitions")}</h2>
      <RequestState
        signal={signal}
        on_success={() => {
          const rows = signal.value.data ?? [];
          if (rows.length === 0)
            return <p class="info-box">{t("cleanup.no-cleanable-data")}</p>;
          return (
            <table>
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("common.key")}</th>
                  <th>{t("cleanup.version")}</th>
                  <th>{t("cleanup.finished")}</th>
                  <th>{t("cleanup.cleanable")}</th>
                  <th>{t("cleanup.ttl")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.decisionDefinitionId}>
                    <th scope="row">
                      <a href={`/decisions/${row.decisionDefinitionId}`}>
                        {row.decisionDefinitionName ??
                          row.decisionDefinitionKey ??
                          row.decisionDefinitionId}
                      </a>
                    </th>
                    <td>{row.decisionDefinitionKey}</td>
                    <td>{row.decisionDefinitionVersion}</td>
                    <td>{num(row.finishedDecisionInstanceCount)}</td>
                    <td>{num(row.cleanableDecisionInstanceCount)}</td>
                    <td>
                      <TtlEditor
                        id={row.decisionDefinitionId}
                        value={row.historyTimeToLive}
                        on_save={(id, ttl) =>
                          engine_rest.cleanup.set_decision_definition_ttl(
                            state,
                            id,
                            ttl,
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }}
      />
    </section>
  );
};

const CleanableBatches = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    signal = state.api.cleanup.cleanable.batches;

  return (
    <section>
      <h2>{t("cleanup.batches")}</h2>
      <RequestState
        signal={signal}
        on_success={() => {
          const rows = signal.value.data ?? [];
          if (rows.length === 0)
            return <p class="info-box">{t("cleanup.no-cleanable-data")}</p>;
          return (
            <table>
              <thead>
                <tr>
                  <th>{t("common.type")}</th>
                  <th>{t("cleanup.finished")}</th>
                  <th>{t("cleanup.cleanable")}</th>
                  <th>{t("cleanup.ttl")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.batchType}>
                    <th scope="row">{row.batchType}</th>
                    <td>{num(row.finishedBatchCount)}</td>
                    <td>{num(row.cleanableBatchCount)}</td>
                    <td>{nullable(row.historyTimeToLive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }}
      />
    </section>
  );
};

const TtlEditor = ({ id, value, on_save }) => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    ttl = useSignal(value ?? "");

  const submit = async (event) => {
    event.preventDefault();
    const next = ttl.value === "" ? null : Number(ttl.value);
    await on_save(id, next);
    load_cleanup(state);
  };

  return (
    <form class="cleanup-ttl" onSubmit={submit}>
      <input
        aria-label={t("cleanup.ttl")}
        type="number"
        min="0"
        value={ttl.value}
        onInput={(event) => (ttl.value = event.currentTarget.value)}
      />
      <button type="submit">{t("cleanup.save-ttl")}</button>
    </form>
  );
};

export { CleanupPage };
