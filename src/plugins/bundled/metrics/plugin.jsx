/**
 * Engine Metrics — the reference bundled plugin.
 *
 * Demonstrates the two major seams end-to-end:
 *   - a top-level PAGE (route + nav + hotkey + GoTo) at /plugin/metrics
 *   - a PROCESS_DEFINITION_TAB ("heat") injected into the Processes panel
 *
 * It owns its API namespace (engine_rest.plugins.metrics.*), its state branch
 * (state.api.plugins.metrics.*), its translations and its styles — sharing no
 * host signals, which proves namespace isolation. Bundled plugins import the
 * host directly; remote no-build plugins use window.__OPERATON_PLUGIN_HOST__.
 */
import { useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { signal } from "@preact/signals";
import { GET } from "../../../api/helper.jsx";
import { RequestState } from "../../../api/engine_rest.jsx";
import { PLUGIN_POINTS } from "../../points.js";
import { use_plugin_api } from "../../plugin_api.jsx";
import "./metrics.css";

const PLUGIN_ID = "metrics";

// ISO 8601 timestamp n months before now — the engine's metrics `startDate`.
const months_ago_iso = (n) => {
  const date = new Date();
  date.setMonth(date.getMonth() - n);
  return date.toISOString();
};

// API namespace — mounted at engine_rest.plugins.metrics. Each function follows
// the host convention (state, ...args) => VERB(url, state, signal), so auth,
// error shapes and RESPONSE_STATE all come for free from helper.jsx.
const api = {
  version: (state) =>
    GET("/version", state, state.api.plugins[PLUGIN_ID].version),
  process_starts: (state) =>
    GET(
      `/metrics/root-process-instance-start/sum?startDate=${months_ago_iso(12)}`,
      state,
      state.api.plugins[PLUGIN_ID].process_starts,
    ),
  flow_nodes: (state) =>
    GET(
      `/metrics/activity-instance-start/sum?startDate=${months_ago_iso(12)}`,
      state,
      state.api.plugins[PLUGIN_ID].flow_nodes,
    ),
};

// State branch — mounted at state.api.plugins.metrics.
const make_signals = () => ({
  version: signal(null),
  process_starts: signal(null),
  flow_nodes: signal(null),
  definition_stats: signal(null),
});

const MetricValue = ({ signal: signl, format = (v) => v }) => (
  <RequestState
    signal={signl}
    on_success={() => <p class="metric-value">{format(signl.value.data)}</p>}
  />
);

const MetricsPage = () => {
  const { state, api: metrics, signals } = use_plugin_api(PLUGIN_ID);
  const [t] = useTranslation();

  useEffect(() => {
    metrics.version(state);
    metrics.process_starts(state);
    metrics.flow_nodes(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main id="content" class="metrics-page fade-in">
      <h1>{t("plugins.metrics.title")}</h1>
      <section class="metrics-cards">
        <article>
          <h2>{t("plugins.metrics.version")}</h2>
          <MetricValue signal={signals.version} format={(d) => d.version} />
        </article>
        <article>
          <h2>{t("plugins.metrics.process-starts")}</h2>
          <MetricValue
            signal={signals.process_starts}
            format={(d) => d.result}
          />
        </article>
        <article>
          <h2>{t("plugins.metrics.flow-nodes")}</h2>
          <MetricValue signal={signals.flow_nodes} format={(d) => d.result} />
        </article>
      </section>
    </main>
  );
};

const count_incidents = (row) =>
  (row.incidents ?? []).reduce((sum, i) => sum + (i.incidentCount ?? 0), 0);

const DefinitionHeatTab = () => {
  const { params, get, signals } = use_plugin_api(PLUGIN_ID);
  const [t] = useTranslation();

  useEffect(() => {
    if (params.definition_id)
      get(
        `/process-definition/${params.definition_id}/statistics?incidents=true`,
        signals.definition_stats,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.definition_id]);

  return (
    <div class="metrics-heat fade-in">
      <RequestState
        signal={signals.definition_stats}
        on_success={() => (
          <table>
            <thead>
              <tr>
                <th>{t("plugins.metrics.activity")}</th>
                <th>{t("plugins.metrics.instances")}</th>
                <th>{t("plugins.metrics.incidents")}</th>
              </tr>
            </thead>
            <tbody>
              {signals.definition_stats.value.data.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.instances}</td>
                  <td>{count_incidents(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </div>
  );
};

const translations = {
  "en-US": {
    plugins: {
      metrics: {
        nav: "Metrics",
        title: "Engine Metrics",
        version: "Engine version",
        "process-starts": "Process starts (12 mo)",
        "flow-nodes": "Flow nodes executed (12 mo)",
        "tab-heat": "Heat",
        activity: "Activity",
        instances: "Instances",
        incidents: "Incidents",
      },
    },
  },
  "de-DE": {
    plugins: {
      metrics: {
        nav: "Kennzahlen",
        title: "Engine-Kennzahlen",
        version: "Engine-Version",
        "process-starts": "Prozessstarts (12 Mon.)",
        "flow-nodes": "Ausgeführte Flow-Knoten (12 Mon.)",
        "tab-heat": "Auslastung",
        activity: "Aktivität",
        instances: "Instanzen",
        incidents: "Vorfälle",
      },
    },
  },
};

export default [
  {
    id: PLUGIN_ID,
    point: PLUGIN_POINTS.PAGE,
    priority: 0,
    properties: {
      path: "/plugin/metrics",
      href: "/plugin/metrics",
      nameKey: "plugins.metrics.nav",
      hotkey: "alt+shift+8",
    },
    Component: MetricsPage,
    api,
    signals: make_signals,
    translations,
  },
  {
    id: "metrics.definition-heat",
    point: PLUGIN_POINTS.PROCESS_DEFINITION_TAB,
    priority: -10,
    properties: { id: "heat", nameKey: "plugins.metrics.tab-heat" },
    Component: DefinitionHeatTab,
  },
];
