import { useSignal } from "@preact/signals";
import { useContext, useEffect } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { useTranslation } from "react-i18next";
import engine_rest, {
  RequestState,
  RESPONSE_STATE,
} from "../api/engine_rest.jsx";
import * as Icons from "../assets/icons.jsx";
import { AppState } from "../state.js";
import { BPMNViewer } from "../components/BPMNViewer.jsx";
import { ListFilter } from "../components/ListFilter.jsx";
import { ManageFilters } from "../components/ManageFilters.jsx";
import {
  filter_share_link,
  parse_list_query,
  with_manage,
  without_manage,
  write_list_query,
} from "../helper/list_query.js";
import {
  create_saved_filter,
  delete_saved_filter,
  hydrate_signal,
  update_saved_filter,
} from "../helper/saved_filters.js";

const RESOURCE_TYPE = "process_definition";
const INSTANCE_RESOURCE_TYPE = "process_instance";

const INSTANCE_SORT_OPTIONS = [
  { key: "startTime", nameKey: "processes.instance.sort.startTime" },
  { key: "instanceId", nameKey: "processes.instance.sort.instanceId" },
  { key: "definitionKey", nameKey: "processes.instance.sort.definitionKey" },
  { key: "businessKey", nameKey: "processes.instance.sort.businessKey" },
  { key: "tenantId", nameKey: "processes.instance.sort.tenantId" },
];

const INSTANCE_FILTER_KEYS = [
  { key: "businessKey", nameKey: "processes.instance.filter_keys.businessKey", type: "string" },
  { key: "businessKeyLike", nameKey: "processes.instance.filter_keys.businessKeyLike", type: "string" },
  { key: "active", nameKey: "processes.instance.filter_keys.active", type: "boolean" },
  { key: "suspended", nameKey: "processes.instance.filter_keys.suspended", type: "boolean" },
  { key: "finished", nameKey: "processes.instance.filter_keys.finished", type: "boolean" },
  { key: "withIncidents", nameKey: "processes.instance.filter_keys.withIncidents", type: "boolean" },
  { key: "withoutIncidents", nameKey: "processes.instance.filter_keys.withoutIncidents", type: "boolean" },
  { key: "startedBefore", nameKey: "processes.instance.filter_keys.startedBefore", type: "date" },
  { key: "startedAfter", nameKey: "processes.instance.filter_keys.startedAfter", type: "date" },
];

const INSTANCE_DEFAULTS = { sortBy: "startTime", sortOrder: "asc" };

const instance_params_from_query = (state, query) => {
  const { saved_filter_id, sortBy, sortOrder, criteria } = parse_list_query(query);
  const saved = find_saved(state.api.process.instance.saved_filters, saved_filter_id);
  return {
    ...(saved?.query ?? {}),
    ...criteria,
    ...(sortBy ? { sortBy } : {}),
    ...(sortOrder ? { sortOrder } : {}),
  };
};

const SORT_OPTIONS = [
  { key: "name", nameKey: "processes.sort.name" },
  { key: "key", nameKey: "processes.sort.key" },
  { key: "category", nameKey: "processes.sort.category" },
  { key: "id", nameKey: "processes.sort.id" },
  { key: "version", nameKey: "processes.sort.version" },
  { key: "deploymentId", nameKey: "processes.sort.deploymentId" },
  { key: "tenantId", nameKey: "processes.sort.tenantId" },
];

const FILTER_KEYS = [
  { key: "name", nameKey: "processes.filter_keys.name", type: "string" },
  { key: "nameLike", nameKey: "processes.filter_keys.nameLike", type: "string" },
  { key: "key", nameKey: "processes.filter_keys.key", type: "string" },
  { key: "keyLike", nameKey: "processes.filter_keys.keyLike", type: "string" },
  { key: "category", nameKey: "processes.filter_keys.category", type: "string" },
  { key: "categoryLike", nameKey: "processes.filter_keys.categoryLike", type: "string" },
  { key: "versionTag", nameKey: "processes.filter_keys.versionTag", type: "string" },
  { key: "active", nameKey: "processes.filter_keys.active", type: "boolean" },
  { key: "suspended", nameKey: "processes.filter_keys.suspended", type: "boolean" },
  { key: "latestVersion", nameKey: "processes.filter_keys.latestVersion", type: "boolean" },
  { key: "startableInTasklist", nameKey: "processes.filter_keys.startableInTasklist", type: "boolean" },
];

const find_saved = (signal, id) => {
  if (!id || id === "all") return null;
  return (signal.value?.data ?? []).find((f) => f.id === id) ?? null;
};

const load_definitions = (state, query) => {
  const { saved_filter_id, sortBy, sortOrder, criteria } = parse_list_query(query);
  const saved = find_saved(state.api.process.definition.saved_filters, saved_filter_id);
  const params = {
    ...(saved?.query ?? {}),
    ...criteria,
    ...(sortBy ? { sortBy } : {}),
    ...(sortOrder ? { sortOrder } : {}),
  };
  void engine_rest.process_definition.list(state, params);
};

/**
 * Keep the `?history=true` query params of the URL alive as long as the history
 * mode is active.
 *
 * @param query Provide the result of `useRoute().query`
 * @returns {string} Either returns `?history=true` when history mode is active or an empty string when not.
 */
const keep_history_query = (query) => {
  if (query.history) {
    return "?history=true";
  }
  return "";
};

const ProcessesPage = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    [t] = useTranslation(),
    history_mode = query.history === "true";

  // Fetch per-definition data when the active definition changes. Statistics
  // power the "active instances" diagram tokens and are fetched in both live
  // and history mode so the tokens remain visible when toggling.
  useEffect(() => {
    if (params.definition_id) {
      void engine_rest.process_definition.one(state, params.definition_id);
      void engine_rest.process_definition.diagram(state, params.definition_id);
      void engine_rest.process_definition.statistics(
        state,
        params.definition_id,
      );
    } else {
      load_definitions(state, query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.definition_id, JSON.stringify(query)]);

  useEffect(() => {
    hydrate_signal(RESOURCE_TYPE, state.api.process.definition.saved_filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activity instances are only available for live (non-history) instances.
  useEffect(() => {
    if (params.selection_id && !history_mode) {
      void engine_rest.process_instance.activity_instances(
        state,
        params.selection_id,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  // When the active definition changes, drop stale per-definition data so
  // tab subtrees cannot momentarily render against the previous definition's
  // signals (which would otherwise re-trigger fetches under the consolidated
  // route and produce flickering counts).
  useEffect(() => {
    return () => {
      state.api.process.definition.one.value = null;
      state.api.process.definition.diagram.value = null;
      state.api.process.definition.statistics.value = null;
      state.api.process.instance.list.value = null;
      state.api.process.instance.one.value = null;
      state.api.process.instance.activity_instances.value = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.definition_id]);

  const def_selected = !!params.definition_id;
  const diagram_maximized = useSignal(false);

  return (
    <main id="processes">
      <ProcessSubNav />
      <div>
        {(!def_selected || !diagram_maximized.value) && (
          <div class="content">
            {!def_selected ? (
              <ProcessDefinitionSelection />
            ) : (
              <ProcessDefinitionDetails />
            )}
          </div>
        )}
        {def_selected && (
          <div class={`diagram ${diagram_maximized.value ? "maximized" : ""}`}>
            <button
              type="button"
              class="diagram-maximize-btn"
              onClick={() =>
                (diagram_maximized.value = !diagram_maximized.value)
              }
              title={
                diagram_maximized.value
                  ? t("processes.diagram-restore")
                  : t("processes.diagram-maximize")
              }
              aria-label={
                diagram_maximized.value
                  ? t("processes.diagram-restore")
                  : t("processes.diagram-maximize")
              }
            >
              {diagram_maximized.value ? (
                <Icons.arrows_pointing_in />
              ) : (
                <Icons.arrows_pointing_out />
              )}
            </button>
            <div id="canvas" />
            <ProcessDiagram />
          </div>
        )}
      </div>
    </main>
  );
};

/**
 * The Processes page sub-navigation.
 *
 *   Definitions  ›  Instances (N)   Incidents (M)   Called Definitions   Jobs                [history toggle]
 *
 * The chevron after `Definitions` indicates that the rest are *children of
 * the selected definition*. They are dimmed (and unclickable) until a
 * definition is selected. The history-mode toggle is pinned to the right.
 */
const ProcessSubNav = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    { params, query, path } = useRoute(),
    { route } = useLocation(),
    history_active = query.history === "true",
    history_query = history_active ? "?history=true" : "",
    on_definitions = !params.definition_id,
    instance_count =
      state.api.process.definition.statistics.value?.data?.reduce(
        (n, a) => n + (a.instances ?? 0),
        0,
      ),
    incident_count =
      state.api.process.definition.statistics.value?.data?.reduce(
        (n, a) => n + (a.incidents?.length ?? 0),
        0,
      );

  return (
    <nav aria-label="Processes navigation">
      <menu>
        <li>
          <a
            href={`/processes${history_query}`}
            aria-current={on_definitions ? "page" : undefined}
          >
            {t("processes.subnav.definitions")}
          </a>
        </li>
        <li class="chevron" aria-hidden="true">
          ›
        </li>
        <NavEntry
          panel="instances"
          label={t("processes.subnav.instances")}
          count={instance_count}
        />
        <NavEntry
          panel="incidents"
          label={t("processes.subnav.incidents")}
          count={incident_count}
        />
        <NavEntry
          panel="called_definitions"
          label={t("processes.subnav.called-definitions")}
        />
        <NavEntry panel="jobs" label={t("processes.subnav.jobs")} />
      </menu>

      <button
        type="button"
        class={`history-toggle ${history_active ? "active" : ""}`}
        onClick={() => route(history_active ? path : `${path}?history=true`)}
      >
        {history_active
          ? t("processes.history-mode-active")
          : t("processes.enable-history-mode")}
      </button>
    </nav>
  );
};

const NavEntry = ({ panel, label, count }) => {
  const { params, query } = useRoute(),
    def_id = params.definition_id,
    has_def = !!def_id,
    active_panel = params.panel ?? (has_def ? "overview" : "definitions"),
    history_query = query.history === "true" ? "?history=true" : "";

  if (!has_def) {
    return (
      <li>
        <span class="disabled">{label}</span>
      </li>
    );
  }
  return (
    <li>
      <a
        href={`/processes/${def_id}/${panel}${history_query}`}
        aria-current={active_panel === panel ? "page" : undefined}
      >
        {label}
        {count !== undefined && ` (${count})`}
      </a>
    </li>
  );
};

/**
 * Tertiary nav for selected children of a definition (instance, incident,
 * called definition, job). Renders a horizontal row of links and resolves
 * the URL to the default tab when none is selected yet.
 */
const ProcessTertiaryNav = ({ tabs, base_path, param = "sub_panel" }) => {
  const { params, query } = useRoute();
  const { route } = useLocation();
  const [t] = useTranslation();

  const active = params[param];
  const hist_q = query.history ? "?history=true" : "";

  // If we land on the parent path with no tab in the URL, push the default.
  useEffect(() => {
    if (!active && tabs.length) {
      route(`${base_path}/${tabs[0].id}${hist_q}`, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base_path, active]);

  return (
    <nav class="tertiary" aria-label="Sub-section navigation">
      <menu>
        {tabs.map((tab) => (
          <li key={tab.id}>
            <a
              href={`${base_path}/${tab.id}${hist_q}`}
              aria-current={active === tab.id ? "page" : undefined}
            >
              {tab.nameKey ? t(tab.nameKey) : tab.name}
            </a>
          </li>
        ))}
      </menu>
    </nav>
  );
};

const DefinitionTabHeading = ({ titleKey }) => {
  const state = useContext(AppState);
  const [t] = useTranslation();
  const def = state.api.process.definition.one.value?.data;
  const def_label = def?.name ?? def?.key;
  return (
    <header>
      <h1>
        {def_label && (
          <>
            <small>{def_label}</small>
            {" / "}
          </>
        )}
        {t(titleKey)}
      </h1>
    </header>
  );
};

const DefinitionMetaPanel = () => {
  const state = useContext(AppState);
  const [t] = useTranslation();
  const def = state.api.process.definition.one.value?.data;
  const stats = state.api.process.definition.statistics.value?.data;
  if (!def) return null;
  const total_instances = stats?.reduce((n, a) => n + (a.instances ?? 0), 0);
  const total_incidents = stats?.reduce(
    (n, a) => n + (a.incidents?.length ?? 0),
    0,
  );
  return (
    <details open>
      <summary>{t("processes.definition-details")}</summary>
      <dl>
        <dt>{t("processes.definition-id")}</dt>
        <dd
          class="font-mono copy-on-click"
          onClick={copyToClipboard}
          title={t("processes.click-to-copy")}
        >
          {def.id ?? "—"}
        </dd>
        <dt>{t("common.key")}</dt>
        <dd>{def.key ?? "—"}</dd>
        <dt>{t("processes.version")}</dt>
        <dd>{def.version ?? "—"}</dd>
        {def.tenantId ? (
          <>
            <dt>{t("processes.tenant-id")}</dt>
            <dd>{def.tenantId}</dd>
          </>
        ) : null}
        {stats ? (
          <>
            <dt>{t("dashboard.instances")}</dt>
            <dd>{total_instances}</dd>
            <dt>{t("processes.tabs.incidents")}</dt>
            <dd>{total_incidents}</dd>
          </>
        ) : null}
      </dl>
    </details>
  );
};

const flatten_activity_instances = (node, out = []) => {
  if (!node) return out;
  const children = node.childActivityInstances ?? [];
  if (children.length === 0) {
    if (node.activityId && node.parentActivityInstanceId) out.push(node);
    return out;
  }
  children.forEach((c) => flatten_activity_instances(c, out));
  return out;
};

const activity_instances_to_tokens = (root) => {
  const leaves = flatten_activity_instances(root);
  const grouped = new Map();
  leaves.forEach((leaf) => {
    const existing = grouped.get(leaf.activityId);
    if (existing) {
      existing.activity_instance_ids.push(leaf.id);
      existing.instances += 1;
    } else {
      grouped.set(leaf.activityId, {
        id: leaf.activityId,
        instances: 1,
        incidents: [],
        activity_instance_ids: [leaf.id],
      });
    }
  });
  return Array.from(grouped.values());
};

const ProcessDiagram = () => {
  const state = useContext(AppState),
    {
      api: {
        process: {
          definition: { diagram, statistics },
          instance: { activity_instances },
        },
      },
    } = state,
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    is_instance_view = params.selection_id !== undefined && !history_mode,
    has_xml =
      diagram.value?.data?.bpmn20Xml !== null &&
      diagram.value?.data?.bpmn20Xml !== undefined,
    show_diagram = params.definition_id !== undefined && has_xml,
    has_statistics =
      statistics.value !== null && statistics.value?.data !== undefined,
    has_activity_instances =
      activity_instances.value?.data !== undefined &&
      activity_instances.value?.data !== null,
    is_ready = is_instance_view ? has_activity_instances : has_statistics,
    tokens = is_instance_view
      ? activity_instances_to_tokens(activity_instances.value?.data)
      : statistics.value?.data,
    mode = is_instance_view ? "instance" : "definition",
    instance_id = is_instance_view ? params.selection_id : undefined;

  /** @namespace diagram.value.data.bpmn20Xml **/
  return (
    <>
      {show_diagram && is_ready ? (
        <BPMNViewer
          xml={diagram.value.data?.bpmn20Xml}
          container="canvas"
          tokens={tokens}
          mode={mode}
          instance_id={instance_id}
        />
      ) : (
        <> </>
      )}
    </>
  );
};

const ProcessDefinitionSelection = () => {
  const state = useContext(AppState),
    {
      api: {
        process: { definition },
      },
    } = state,
    [t] = useTranslation(),
    { query } = useRoute(),
    { route } = useLocation(),
    selected = useSignal(new Set()),
    bulk_running = useSignal(false);

  const parsed = parse_list_query(query);
  const has_criteria = Object.keys(parsed.criteria).length > 0;

  const list_value = definition.list.value;
  const rows = list_value?.data ?? [];
  const has_data = list_value?.status === RESPONSE_STATE.SUCCESS;
  const is_empty = has_data && rows.length === 0 && !has_criteria;

  const apply_patch = (patch) => {
    const next = write_list_query(window.location.href, patch);
    route(next, true);
  };
  const open_manage = () => route(with_manage(), false);
  const list_current = {
    saved_filter_id: parsed.saved_filter_id,
    sortBy: parsed.sortBy ?? "name",
    sortOrder: parsed.sortOrder ?? "asc",
    criteria: parsed.criteria,
  };

  if (query.filters === "manage") return <DefinitionsManage />;

  const toggle_one = (id) => {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected.value = next;
  };
  const toggle_all = () => {
    if (selected.value.size === rows.length && rows.length > 0) {
      selected.value = new Set();
    } else {
      selected.value = new Set(rows.map((r) => r.definition.id));
    }
  };
  const all_selected = rows.length > 0 && selected.value.size === rows.length;

  const run_bulk = async (op) => {
    if (selected.value.size === 0 || bulk_running.value) return;
    bulk_running.value = true;
    try {
      const ids = [...selected.value];
      for (const id of ids) {
        try {
          await engine_rest.process_definition[op](state, id);
        } catch (e) {
          console.error(`bulk ${op} failed for ${id}`, e);
        }
      }
      selected.value = new Set();
      // Refetch to reflect new state.
      load_definitions(state, query);
    } finally {
      bulk_running.value = false;
    }
  };

  const has_selection = selected.value.size > 0;

  return (
    <div class="fade-in">
      <header>
        <h1>{t("processes.deployed-definitions")}</h1>
        <a class="button" href="/deployments">
          {t("processes.deploy")}
        </a>
      </header>

      <div class="toolbar">
        <div>
          <button
            type="button"
            class="secondary"
            disabled={!has_selection || bulk_running.value}
            onClick={() => {
              if (
                window.confirm(
                  t("processes.bulk.confirm-remove", {
                    count: selected.value.size,
                  }),
                )
              ) {
                void run_bulk("remove");
              }
            }}
          >
            {t("processes.bulk.remove")}
          </button>
          <button
            type="button"
            class="secondary"
            disabled={!has_selection || bulk_running.value}
            onClick={() => run_bulk("activate")}
          >
            {t("processes.bulk.activate")}
          </button>
          <button
            type="button"
            class="secondary"
            disabled={!has_selection || bulk_running.value}
            onClick={() => run_bulk("suspend")}
          >
            {t("processes.bulk.suspend")}
          </button>
          {has_selection && (
            <small>
              {t("processes.bulk.count", { count: selected.value.size })}
            </small>
          )}
        </div>
      </div>
      <ListFilter
        sort_options={SORT_OPTIONS}
        saved_filters_signal={definition.saved_filters}
        current={list_current}
        defaults={{ sortBy: "name", sortOrder: "asc" }}
        on_change={apply_patch}
        on_manage={open_manage}
      />

      {is_empty ? (
        <DefinitionsEmpty />
      ) : (
        <div>
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label={t("processes.bulk.select-all")}
                    checked={all_selected}
                    onChange={toggle_all}
                  />
                </th>
                <th>{t("common.name")}</th>
                <th class="num">{t("processes.tabs.incidents")}</th>
                <th class="num">{t("dashboard.instances")}</th>
                <th>{t("common.key")}</th>
                <th class="num">{t("processes.version")}</th>
                <th>{t("common.id")}</th>
                <th>{t("processes.tenant-id")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <ProcessDefinition
                  key={entry.definition.id}
                  checked={selected.value.has(entry.definition.id)}
                  onToggle={() => toggle_one(entry.definition.id)}
                  {...entry}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const DefinitionsEmpty = () => {
  const [t] = useTranslation();
  return (
    <div class="empty-state">
      <p>{t("processes.empty.heading")}</p>
      <a href="/deployments">{t("processes.empty.upload")}</a>
      <a
        href="https://docs.operaton.org/manual/latest/installation/full/tomcat/manual/"
        target="_blank"
        rel="noreferrer"
      >
        {t("processes.empty.how-to")}
      </a>
    </div>
  );
};

const ProcessDefinitionDetails = () => {
  const { params } = useRoute();
  const active_tab = process_definition_tabs.find(
    (tab) => tab.id === params.panel,
  );

  if (!active_tab) return <DefinitionOverview />;

  // Heading + meta panel stay mounted across tab switches; only the panel
  // content (keyed by tab id) re-mounts so its fade-in plays.
  return (
    <>
      <DefinitionTabHeading titleKey={active_tab.nameKey} />
      <DefinitionMetaPanel />
      <div class="fade-in" key={active_tab.id}>
        <active_tab.Component />
      </div>
    </>
  );
};

const DefinitionOverview = () => {
  const {
      api: {
        process: {
          definition: { one: process_definition, statistics },
        },
      },
    } = useContext(AppState),
    [t] = useTranslation();

  /** @namespace process_definition.value.data.tenantId **/
  /** @namespace process_definition.value.data.deploymentId **/
  /** @namespace process_definition.value.data.resource **/
  return (
    <RequestState
      signal={process_definition}
      on_success={() => {
        const def = process_definition.value?.data;
        const stats = statistics.value?.data ?? [];
        const total_instances = stats.reduce(
          (n, a) => n + (a.instances ?? 0),
          0,
        );
        const total_incidents = stats.reduce(
          (n, a) => n + (a.incidents?.length ?? 0),
          0,
        );
        return (
          <div>
            <header>
              <h1>{def?.name ?? def?.key}</h1>
            </header>
            <dl>
              <dt>{t("processes.definition-id")}</dt>
              <dd
                class="font-mono copy-on-click"
                onClick={copyToClipboard}
                title={t("processes.click-to-copy")}
              >
                {def?.id ?? "—"}
              </dd>
              <dt>{t("common.key")}</dt>
              <dd>{def?.key ?? "—"}</dd>
              <dt>{t("processes.version")}</dt>
              <dd>{def?.version ?? "—"}</dd>
              {def?.tenantId ? (
                <>
                  <dt>{t("processes.tenant-id")}</dt>
                  <dd>{def.tenantId}</dd>
                </>
              ) : null}
              <dt>{t("dashboard.instances")}</dt>
              <dd>{total_instances}</dd>
              <dt>{t("processes.tabs.incidents")}</dt>
              <dd>{total_incidents}</dd>
            </dl>
          </div>
        );
      }}
    />
  );
};

const ProcessDefinition = ({
  definition: { id, name, key, version, tenantId },
  instances,
  incidents,
  checked,
  onToggle,
}) => {
  const { query } = useRoute();
  return (
    <tr aria-selected={checked}>
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={name ?? id}
          checked={!!checked}
          onChange={onToggle}
        />
      </td>
      <td>
        <a href={`/processes/${id}/instances${keep_history_query(query)}`}>
          {name ?? key}
        </a>
      </td>
      <td class="num">{incidents?.length ?? 0}</td>
      <td class="num">{instances ?? 0}</td>
      <td>{key}</td>
      <td class="num">{version}</td>
      <td class="font-mono">{id}</td>
      <td>{tenantId ?? "—"}</td>
    </tr>
  );
};

const Instances = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    history_mode = query.history === "true",
    list = state.api.process.instance.list;

  useEffect(() => {
    hydrate_signal(
      INSTANCE_RESOURCE_TYPE,
      state.api.process.instance.saved_filters,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetch_page = (firstResult) => {
    const extra = instance_params_from_query(state, query);
    if (history_mode) {
      void engine_rest.history.process_instance.all(
        state,
        params.definition_id,
        extra,
        firstResult,
      );
    } else {
      void engine_rest.history.process_instance.all_unfinished(
        state,
        params.definition_id,
        extra,
        firstResult,
      );
    }
  };

  // Signature of the filter-relevant slice of the URL: changes drive a refetch
  // via the effect below. Keeping the reserved keys + q.* keys in scope lets
  // history toggle, sort changes, saved-filter pick and criteria edits all
  // funnel through the same reload path.
  const criteria_signature = Object.entries(query ?? {})
    .filter(([k]) => ["filter", "sortBy", "sortOrder"].includes(k) || k.startsWith("q."))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");

  useEffect(() => {
    if (!params.selection_id) fetch_page(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.definition_id, params.selection_id, history_mode, criteria_signature]);

  const load_more = () => fetch_page(list.value?.data?.length ?? 0);

  const parsed = parse_list_query(query);
  const list_current = {
    saved_filter_id: parsed.saved_filter_id,
    sortBy: parsed.sortBy ?? INSTANCE_DEFAULTS.sortBy,
    sortOrder: parsed.sortOrder ?? INSTANCE_DEFAULTS.sortOrder,
    criteria: parsed.criteria,
  };
  const apply_patch = (patch) => {
    route(write_list_query(window.location.href, patch), true);
  };
  const open_manage = () => route(with_manage(), false);

  if (!params?.selection_id && query?.filters === "manage") {
    return <InstancesManage />;
  }

  return !params?.selection_id ? (
    <>
      <ListFilter
        sort_options={INSTANCE_SORT_OPTIONS}
        saved_filters_signal={state.api.process.instance.saved_filters}
        current={list_current}
        defaults={INSTANCE_DEFAULTS}
        on_change={apply_patch}
        on_manage={open_manage}
      />
      <div>
        <table>
          <thead>
            <tr>
              <th>{t("common.id")}</th>
              <th>{t("processes.start-time")}</th>
              <th>{t("common.state")}</th>
              <th>{t("processes.business-key")}</th>
            </tr>
          </thead>
          <tbody>
            <InstanceTableRows />
          </tbody>
        </table>
      </div>
      {list.value?.hasMore === true ? (
        <button class="load-more" onClick={load_more}>
          {t("tasks.load-more")}
        </button>
      ) : list.value?.hasMore === false ? (
        <small class="load-more-end">{t("tasks.no-more-items")}</small>
      ) : null}
    </>
  ) : (
    <InstanceDetails />
  );
};

const InstanceTableRows = () =>
  useContext(AppState).api.process.instance.list.value?.data?.map(
    (instance) => <ProcessInstance key={instance.id} {...instance} />,
  ) ?? null;

const InstanceDetails = () => {
  const state = useContext(AppState),
    {
      params: { selection_id, definition_id, panel },
      query,
    } = useRoute(),
    history_mode = query.history === "true";

  if (selection_id) {
    if (
      state.api.process.instance.one === undefined ||
      state.api.process.instance.one.value === null
    ) {
      if (!history_mode) {
        void engine_rest.process_instance.one(state, selection_id);
      } else {
        void engine_rest.history.process_instance.one(state, selection_id);
      }
    }
  }

  const { params: route_params } = useRoute();
  const sub_panel = route_params.sub_panel;
  const active_tab =
    process_instance_tabs.find((tab) => tab.id === sub_panel) ??
    process_instance_tabs[0];

  return (
    <>
      <InstanceDetailsDescription />
      <ProcessTertiaryNav
        tabs={process_instance_tabs}
        base_path={`/processes/${definition_id}/${panel}/${selection_id}`}
      />
      <div>{active_tab ? <active_tab.Component /> : null}</div>
    </>
  );
};

const InstanceDetailsDescription = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    data = state.api.process.instance.one.value?.data;

  return (
    <dl>
      <dt>{t("processes.instance-id")}</dt>
      <dd
        class="font-mono copy-on-click"
        onClick={copyToClipboard}
        title={t("processes.click-to-copy")}
      >
        {data?.id ?? "—"}
      </dd>
      <dt>{t("processes.business-key")}</dt>
      <dd>{data?.businessKey ?? "—"}</dd>
    </dl>
  );
};

const ProcessInstance = ({ id, startTime, state, businessKey }) => {
  const { params, query } = useRoute();
  return (
    <tr>
      <td class="font-mono">
        <a
          href={`/processes/${params.definition_id}/instances/${id}/vars${keep_history_query(query)}`}
        >
          {id.substring(0, 8)}
        </a>
      </td>
      <td>
        <time datetime={startTime}>
          {new Date(Date.parse(startTime)).toLocaleString()}
        </time>
      </td>
      <td>{state}</td>
      <td>{businessKey}</td>
    </tr>
  );
};

const InstanceVariables = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation(),
    selection_exists =
      state.api.process.instance.variables.value !== null &&
      state.api.process.instance.variables.value.data !== null &&
      state.api.process.instance.variables.value.data !== undefined;

  useEffect(() => {
    if (!history_mode) {
      void engine_rest.process_instance.variables(state, params.selection_id);
    } else {
      void engine_rest.history.variable_instance.by_process_instance(
        state,
        params.selection_id,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>{t("common.name")}</th>
            <th>{t("common.type")}</th>
            <th>{t("common.value")}</th>
            <th>{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {selection_exists
            ? !history_mode
              ? Object.entries(
                  state.api.process.instance.variables.value.data,
                ).map(
                  ([name, { type, value }]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{type}</td>
                      <td>{value}</td>
                    </tr>
                  ),
                )
              : state.api.process.instance.variables.value.data.map(
                  ({ name, type, value }) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{type}</td>
                      <td>{value}</td>
                    </tr>
                  ),
                )
            : t("common.loading")}
        </tbody>
      </table>
    </div>
  );
};

const InstanceIncidents = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation();

  // The incident endpoint is history-only in Camunda 7, but timestamp filters
  // applied via history mode (e.g. closed instance window) can change the
  // returned set — re-fetch on toggle.
  useEffect(() => {
    void engine_rest.history.incident.by_process_instance(
      state,
      params.selection_id,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  /** @namespace state.api.history.incident.by_process_instance.value.data **/
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>{t("processes.incidents.message")}</th>
            <th>{t("processes.incidents.process-instance")}</th>
            <th>{t("processes.incidents.timestamp")}</th>
            <th>{t("common.activity")}</th>
            <th>{t("processes.incidents.failing-activity")}</th>
            <th>{t("processes.incidents.cause-process-instance-id")}</th>
            <th>{t("processes.incidents.root-cause-process-instance-id")}</th>
            <th>{t("common.type")}</th>
            <th>{t("processes.incidents.annotation")}</th>
            <th>{t("common.action")}</th>
          </tr>
        </thead>
        <tbody>
          {state.api.history.incident.by_process_instance.value?.data?.map(
            // eslint-disable-next-line react/jsx-key
            ({
              id,
              incidentMessage,
              processInstanceId,
              createTime,
              activityId,
              failedActivityId,
              causeIncidentId,
              rootCauseIncidentId,
              incidentType,
              annotation,
            }) => (
              <tr key={id}>
                <td>{incidentMessage}</td>
                <td>
                  <UUIDLink path={"/processes"} uuid={processInstanceId} />
                </td>
                <td>
                  <time datetime={createTime}>
                    {createTime ? createTime.substring(0, 19) : "-/-"}
                  </time>
                </td>
                <td>{activityId}</td>
                <td>{failedActivityId}</td>
                <td>
                  <UUIDLink path={""} uuid={causeIncidentId} />
                </td>
                <td>
                  <UUIDLink path={""} uuid={rootCauseIncidentId} />
                </td>
                <td>{incidentType}</td>
                <td>{annotation}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const InstanceUserTasks = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation();

  useEffect(() => {
    if (history_mode) {
      void engine_rest.history.task.by_process_instance(
        state,
        params.selection_id,
      );
    } else {
      void engine_rest.task.get_process_instance_tasks(
        state,
        params.selection_id,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  // /history/task returns `startTime` instead of `created` and omits
  // `delegationState`; normalise to the live shape so the table render below
  // doesn't need a second code path.
  const rows = history_mode
    ? (state.api.history.task.by_process_instance.value?.data ?? []).map((t) => ({
        ...t,
        created: t.startTime,
        delegationState: t.delegationState ?? null,
      }))
    : (state.api.task.by_process_instance.value?.data ?? []);

  /** @namespace state.api.task.by_process_instance.value.data **/
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>{t("common.activity")}</th>
            <th>{t("dashboard.assignee")}</th>
            <th>{t("processes.user-tasks.owner")}</th>
            <th>{t("dashboard.created")}</th>
            <th>{t("processes.user-tasks.due")}</th>
            <th>{t("processes.user-tasks.follow-up")}</th>
            <th>{t("tasks.task-list.table-headings.priority")}</th>
            <th>{t("processes.user-tasks.delegation-state")}</th>
            <th>{t("processes.user-tasks.task-id")}</th>
            <th>{t("common.action")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(
            // eslint-disable-next-line react/jsx-key
            ({
              id,
              assignee,
              name,
              owner,
              created,
              due,
              followUp,
              priority,
              delegationState,
            }) => (
              <tr key={id}>
                <td>{name}</td>
                <td>{assignee}</td>
                <td>{owner}</td>
                <td>
                  {created ? <time datetime={created}>{created}</time> : null}
                </td>
                <td>{due ? <time datetime={due}>{due}</time> : null}</td>
                <td>
                  {followUp ? (
                    <time datetime={followUp}>{followUp}</time>
                  ) : null}
                </td>
                <td>{priority}</td>
                <td>{priority}</td>
                <td>{delegationState}</td>
                <td>
                  <UUIDLink path="/" uuid={id} />
                </td>
                <td>
                  <button>{t("processes.user-tasks.groups")}</button>
                  <button>{t("processes.user-tasks.users")}</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const CalledProcessInstances = () => {
  const state = useContext(AppState),
    { selection_id, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation();

  useEffect(() => {
    if (history_mode) {
      void engine_rest.history.process_instance.called(state, selection_id);
    } else {
      void engine_rest.process_instance.called(state, selection_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection_id, history_mode]);

  // /history/process-instance uses `state` ("ACTIVE"/"COMPLETED"/...) and
  // `processDefinitionId`; the live endpoint uses `suspended` (bool) and
  // `definitionId`. Normalise to one shape for rendering.
  const rows = (history_mode
    ? state.api.history.process_instance.called.value?.data
    : state.api.process.instance.called.value?.data) ?? [];

  /** @namespace state.api.process.instance.called.value.data **/
  /** @namespace instance.definitionId **/
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>{t("common.state")}</th>
            <th>{t("processes.called-instances.called-process-instance")}</th>
            <th>{t("processes.called-instances.process-definition")}</th>
            <th>{t("common.activity")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((instance) => {
            const definition_id = instance.processDefinitionId ?? instance.definitionId;
            const state_label = history_mode
              ? instance.state
              : instance.suspended
                ? t("common.suspended")
                : t("common.running");
            return (
              <tr key={instance.id}>
                <td>{state_label}</td>
                <td>
                  <a
                    href={`/processes/${instance.id}${keep_history_query(query)}`}
                  >
                    {instance.id}
                  </a>
                </td>
                <td>{definition_id}</td>
                <td>{definition_id}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Incidents = () => {
  const state = useContext(AppState),
    { definition_id } = useRoute(),
    [t] = useTranslation();

  useEffect(() => {
    void engine_rest.history.incident.by_process_definition(
      state,
      definition_id,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition_id]);

  /** @namespace instance.incidentMessage **/
  /** @namespace instance.incidentType **/
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>{t("processes.incidents.message")}</th>
            <th>{t("common.type")}</th>
            <th>{t("processes.incidents.configuration")}</th>
          </tr>
        </thead>
        <tbody>
          {state.api.history.incident.by_process_definition.value?.data?.map(
            (incident) => (
              <tr key={incident.id}>
                <td>{incident.incidentMessage}</td>
                <td>{incident.incidentType}</td>
                <td>{incident.configuration}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const CalledProcessDefinitions = () => {
  const state = useContext(AppState),
    { definition_id, query } = useRoute(),
    history_mode = query?.history === "true",
    [t] = useTranslation();

  useEffect(() => {
    void engine_rest.process_definition.called(state, definition_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition_id]);

  /** @namespace definition.calledFromActivityIds **/
  return (
    <div>
      {history_mode && (
        <small class="history-na">{t("processes.history-mode-na")}</small>
      )}
      <table>
        <thead>
          <tr>
            <th>
              {t("processes.called-definitions.called-process-definition")}
            </th>
            <th>{t("common.state")}</th>
            <th>{t("common.activity")}</th>
          </tr>
        </thead>
        <tbody>
          {state.api.process.definition.called.value?.data?.map(
            (definition) => (
              <tr key={definition.id}>
                <td>
                  <a
                    href={`/processes/${definition.id}${keep_history_query(query)}`}
                  >
                    {definition.name}
                  </a>
                </td>
                <td>
                  {definition.suspended
                    ? t("common.suspended")
                    : t("common.running")}
                </td>
                <td>{definition.calledFromActivityIds.map((a) => `${a}, `)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const JobDefinitions = () => {
  const state = useContext(AppState),
    { definition_id, query } = useRoute(),
    history_mode = query?.history === "true",
    [t] = useTranslation();

  useEffect(() => {
    void engine_rest.job_definition.all.by_process_definition(
      state,
      definition_id,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition_id]);

  /** @namespace state.api.job_definition.all.by_process_definition.value.data **/
  /** @namespace definition.jobType **/
  /** @namespace definition.jobConfiguration **/
  /** @namespace definition.overridingJobPriority **/
  return (
    <div class="relative">
      {history_mode && (
        <small class="history-na">{t("processes.history-mode-na")}</small>
      )}
      {state.api.job_definition.retries.value ? (
        <RequestState
          signal={state.api.job_definition.retries}
          on_success={() => (
            <p class="success">{t("processes.jobs.retries-success")}</p>
          )}
        />
      ) : null}
      <table>
        <thead>
          <tr>
            <th>{t("common.state")}</th>
            <th>{t("common.activity")}</th>
            <th>{t("common.type")}</th>
            <th>{t("processes.incidents.configuration")}</th>
            <th>{t("processes.jobs.overriding-job-priority")}</th>
            <th>{t("common.action")}</th>
          </tr>
        </thead>
        <tbody>
          {state.api.job_definition.all.by_process_definition.value?.data?.map(
            (definition) => (
              <JobDefinitionRow key={definition.id} definition={definition} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const JobDefinitionRow = ({ definition }) => {
  const state = useContext(AppState),
    { definition_id } = useRoute(),
    [t] = useTranslation(),
    retries = useSignal(""),
    due_date = useSignal(""),
    due_time = useSignal(""),
    input_id = `job-retries-${definition.id}`;

  const refresh = () =>
      engine_rest.job_definition.all.by_process_definition(
        state,
        definition_id,
      ),
    format_due_date = () =>
      due_date.value
        ? `${due_date.value}T${due_time.value || "00:00"}:00.000+0000`
        : null,
    on_submit = (e) => {
      e.preventDefault();
      const raw = String(retries.value).trim();
      if (raw === "") return;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) return;
      void engine_rest.job_definition.set_retries(
        state,
        definition.id,
        parsed,
        format_due_date(),
      ).then(refresh);
    };

  return (
    <tr>
      <td>
        {definition.suspended
          ? t("common.suspended")
          : t("common.active")}
      </td>
      <td>{definition.activityId ?? "—"}</td>
      <td>{definition.jobType}</td>
      <td>{definition.jobConfiguration}</td>
      <td>{definition.overridingJobPriority ?? "-"}</td>
      <td>
        <form onSubmit={on_submit}>
          <label for={input_id}>{t("processes.jobs.retries")}</label>
          <input
            id={input_id}
            type="number"
            min="0"
            step="1"
            value={retries.value}
            onInput={(e) => (retries.value = e.currentTarget.value)}
            required
          />
          <label for={`${input_id}-date`}>{t("processes.jobs.due-date")}</label>
          <input
            id={`${input_id}-date`}
            type="date"
            value={due_date.value}
            onInput={(e) => (due_date.value = e.currentTarget.value)}
          />
          <label for={`${input_id}-time`}>{t("processes.jobs.due-time")}</label>
          <input
            id={`${input_id}-time`}
            type="time"
            value={due_time.value}
            onInput={(e) => (due_time.value = e.currentTarget.value)}
          />
          <div class="button-group">
            <button type="submit">{t("processes.jobs.set-retries")}</button>
          </div>
        </form>
      </td>
    </tr>
  );
};

const DefinitionsManage = () => {
  const state = useContext(AppState),
    { route } = useLocation(),
    [t] = useTranslation();

  const refresh = () =>
    hydrate_signal(RESOURCE_TYPE, state.api.process.definition.saved_filters);
  return (
    <div class="fade-in">
      <ManageFilters
        title={t("processes.filter.manage_title")}
        saved_filters_signal={state.api.process.definition.saved_filters}
        filter_keys={FILTER_KEYS}
        sort_options={SORT_OPTIONS}
        on_save={(f) => {
          create_saved_filter(RESOURCE_TYPE, f);
          refresh();
        }}
        on_update={(id, f) => {
          update_saved_filter(RESOURCE_TYPE, id, f);
          refresh();
        }}
        on_delete={(id) => {
          delete_saved_filter(RESOURCE_TYPE, id);
          refresh();
        }}
        on_close={() => route(without_manage(), true)}
        build_share_link={(f) => filter_share_link(window.location.href, f)}
      />
    </div>
  );
};

const InstancesManage = () => {
  const state = useContext(AppState),
    { route } = useLocation(),
    [t] = useTranslation();

  const refresh = () =>
    hydrate_signal(
      INSTANCE_RESOURCE_TYPE,
      state.api.process.instance.saved_filters,
    );
  return (
    <ManageFilters
      title={t("processes.instance.manage_title")}
      saved_filters_signal={state.api.process.instance.saved_filters}
      filter_keys={INSTANCE_FILTER_KEYS}
      sort_options={INSTANCE_SORT_OPTIONS}
      on_save={(f) => {
        create_saved_filter(INSTANCE_RESOURCE_TYPE, f);
        refresh();
      }}
      on_update={(id, f) => {
        update_saved_filter(INSTANCE_RESOURCE_TYPE, id, f);
        refresh();
      }}
      on_delete={(id) => {
        delete_saved_filter(INSTANCE_RESOURCE_TYPE, id);
        refresh();
      }}
      on_close={() => route(without_manage(), true)}
      build_share_link={(f) => filter_share_link(window.location.href, f)}
    />
  );
};

const process_definition_tabs = [
  {
    nameKey: "processes.tabs.instances",
    id: "instances",
    pos: 0,
    Component: Instances,
  },
  {
    nameKey: "processes.tabs.incidents",
    id: "incidents",
    pos: 1,
    Component: Incidents,
  },
  {
    nameKey: "processes.tabs.called-definitions",
    id: "called_definitions",
    pos: 2,
    Component: CalledProcessDefinitions,
  },
  {
    nameKey: "processes.tabs.jobs",
    id: "jobs",
    pos: 3,
    Component: JobDefinitions,
  },
];

const UUIDLink = ({ uuid = "?", path }) => (
  <a href={`${path}${keep_history_query(useRoute().query)}`}>
    {uuid.substring(0, 8)}
  </a>
);

// TODO: create Jobs example for old Camunda apps
const InstanceJobsPlaceholder = () => <p>Jobs</p>;
// TODO: create External Apps example for old Camunda apps
const InstanceExternalTasksPlaceholder = () => <p>External Tasks</p>;

const process_instance_tabs = [
  {
    nameKey: "processes.tabs.variables",
    id: "vars",
    pos: 0,
    Component: InstanceVariables,
  },
  {
    nameKey: "processes.tabs.instance-incidents",
    id: "instance_incidents",
    pos: 1,
    Component: InstanceIncidents,
  },
  {
    nameKey: "processes.tabs.called-instances",
    id: "called_instances",
    pos: 2,
    Component: CalledProcessInstances,
  },
  {
    nameKey: "processes.tabs.user-tasks",
    id: "user_tasks",
    pos: 3,
    Component: InstanceUserTasks,
  },
  {
    nameKey: "processes.tabs.jobs",
    id: "jobs",
    pos: 4,
    Component: InstanceJobsPlaceholder,
  },
  {
    nameKey: "processes.tabs.external-tasks",
    id: "external_tasks",
    pos: 5,
    Component: InstanceExternalTasksPlaceholder,
  },
];

// fixme : extract to util file
const copyToClipboard = (event) =>
  navigator.clipboard.writeText(event.target.innerText);

export { ProcessesPage };
