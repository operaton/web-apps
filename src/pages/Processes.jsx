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
import { Dialog, ConfirmDialog } from "../components/Dialog.jsx";
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
  {
    key: "businessKey",
    nameKey: "processes.instance.filter_keys.businessKey",
    type: "string",
  },
  {
    key: "businessKeyLike",
    nameKey: "processes.instance.filter_keys.businessKeyLike",
    type: "string",
  },
  {
    key: "active",
    nameKey: "processes.instance.filter_keys.active",
    type: "boolean",
  },
  {
    key: "suspended",
    nameKey: "processes.instance.filter_keys.suspended",
    type: "boolean",
  },
  {
    key: "finished",
    nameKey: "processes.instance.filter_keys.finished",
    type: "boolean",
  },
  {
    key: "withIncidents",
    nameKey: "processes.instance.filter_keys.withIncidents",
    type: "boolean",
  },
  {
    key: "withoutIncidents",
    nameKey: "processes.instance.filter_keys.withoutIncidents",
    type: "boolean",
  },
  {
    key: "startedBefore",
    nameKey: "processes.instance.filter_keys.startedBefore",
    type: "date",
  },
  {
    key: "startedAfter",
    nameKey: "processes.instance.filter_keys.startedAfter",
    type: "date",
  },
];

const INSTANCE_DEFAULTS = { sortBy: "startTime", sortOrder: "asc" };

const instance_params_from_query = (state, query) => {
  const { saved_filter_id, sortBy, sortOrder, criteria } =
    parse_list_query(query);
  const saved = find_saved(
    state.api.process.instance.saved_filters,
    saved_filter_id,
  );
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
  {
    key: "nameLike",
    nameKey: "processes.filter_keys.nameLike",
    type: "string",
  },
  { key: "key", nameKey: "processes.filter_keys.key", type: "string" },
  { key: "keyLike", nameKey: "processes.filter_keys.keyLike", type: "string" },
  {
    key: "category",
    nameKey: "processes.filter_keys.category",
    type: "string",
  },
  {
    key: "categoryLike",
    nameKey: "processes.filter_keys.categoryLike",
    type: "string",
  },
  {
    key: "versionTag",
    nameKey: "processes.filter_keys.versionTag",
    type: "string",
  },
  { key: "active", nameKey: "processes.filter_keys.active", type: "boolean" },
  {
    key: "suspended",
    nameKey: "processes.filter_keys.suspended",
    type: "boolean",
  },
  {
    key: "latestVersion",
    nameKey: "processes.filter_keys.latestVersion",
    type: "boolean",
  },
  {
    key: "startableInTasklist",
    nameKey: "processes.filter_keys.startableInTasklist",
    type: "boolean",
  },
];

const find_saved = (signal, id) => {
  if (!id || id === "all") return null;
  return (signal.value?.data ?? []).find((f) => f.id === id) ?? null;
};

const load_definitions = (state, query) => {
  const { saved_filter_id, sortBy, sortOrder, criteria } =
    parse_list_query(query);
  const saved = find_saved(
    state.api.process.definition.saved_filters,
    saved_filter_id,
  );
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
    <main id="content" class="processes">
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
    <nav aria-label={t("nav.processes")}>
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
    <nav class="tertiary" aria-label={t("processes.subnav-label")}>
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
        <dd>
          <button
            type="button"
            class="font-mono copy-on-click"
            onClick={copyToClipboard}
            aria-label={t("processes.click-to-copy")}
            title={t("processes.click-to-copy")}
          >
            {def.id ?? "—"}
          </button>
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
                <th class="num" title={t("processes.tabs.incidents")}>
                  {t("processes.col-abbr.incidents")}
                </th>
                <th class="num" title={t("dashboard.instances")}>
                  {t("processes.col-abbr.instances")}
                </th>
                <th>{t("common.key")}</th>
                <th class="num" title={t("processes.version")}>
                  {t("processes.col-abbr.version")}
                </th>
                <th>{t("common.id")}</th>
                <th title={t("processes.tenant-id")}>
                  {t("processes.col-abbr.tenant-id")}
                </th>
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
        rel="noopener"
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
              <dd>
                <button
                  type="button"
                  class="font-mono copy-on-click"
                  onClick={copyToClipboard}
                  aria-label={t("processes.click-to-copy")}
                  title={t("processes.click-to-copy")}
                >
                  {def?.id ?? "—"}
                </button>
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
    .filter(
      ([k]) =>
        ["filter", "sortBy", "sortOrder"].includes(k) || k.startsWith("q."),
    )
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");

  useEffect(() => {
    if (!params.selection_id) fetch_page(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.definition_id,
    params.selection_id,
    history_mode,
    criteria_signature,
  ]);

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
        <button type="button" class="load-more" onClick={load_more}>
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
    history_mode = query.history === "true",
    [t] = useTranslation();

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
    { params, query } = useRoute(),
    { route } = useLocation(),
    history_mode = query.history === "true",
    [t] = useTranslation(),
    confirm_cancel = useSignal(false),
    data = state.api.process.instance.one.value?.data;

  const toggle_suspended = async (suspended) => {
    await engine_rest.process_instance.set_suspended(
      state,
      params.selection_id,
      suspended,
    );
    void engine_rest.process_instance.one(state, params.selection_id);
  };

  const cancel_instance = async () => {
    await engine_rest.process_instance.delete(state, params.selection_id);
    route(`/processes/${params.definition_id}/instances`);
  };

  return (
    <>
      <dl>
        <dt>{t("processes.instance-id")}</dt>
        <dd>
          <button
            type="button"
            class="font-mono copy-on-click"
            onClick={copyToClipboard}
            aria-label={t("processes.click-to-copy")}
            title={t("processes.click-to-copy")}
          >
            {data?.id ?? "—"}
          </button>
        </dd>
        <dt>{t("processes.business-key")}</dt>
        <dd>{data?.businessKey ?? "—"}</dd>
      </dl>
      {!history_mode && data && (
        <div class="button-group">
          {data.suspended ? (
            <button type="button" onClick={() => toggle_suspended(false)}>
              {t("processes.instance.activate")}
            </button>
          ) : (
            <button type="button" onClick={() => toggle_suspended(true)}>
              {t("processes.instance.suspend")}
            </button>
          )}
          <button
            type="button"
            class="danger"
            onClick={() => (confirm_cancel.value = true)}
          >
            {t("processes.instance.cancel")}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirm_cancel}
        message={t("processes.instance.confirm-cancel")}
        confirm_label={t("processes.instance.cancel")}
        cancel_label={t("processes.instance.keep-running")}
        on_confirm={cancel_instance}
      />
    </>
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

// Operaton stores typed variables; coerce the raw text input to the JS type the
// REST API expects for the chosen variable type.
const VARIABLE_TYPES = [
  "String",
  "Boolean",
  "Integer",
  "Long",
  "Double",
  "Short",
  "Json",
];

const coerce_variable_value = (type, raw) => {
  switch (type) {
    case "Boolean":
      return raw === "true" || raw === true;
    case "Integer":
    case "Long":
    case "Short":
      return raw === "" ? null : parseInt(raw, 10);
    case "Double":
    case "Float":
      return raw === "" ? null : parseFloat(raw);
    default:
      return raw;
  }
};

const InstanceVariables = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation(),
    edit_open = useSignal(false),
    delete_open = useSignal(false),
    edit_new = useSignal(false),
    edit_name = useSignal(""),
    edit_type = useSignal("String"),
    edit_value = useSignal(""),
    delete_name = useSignal(null),
    selection_exists =
      state.api.process.instance.variables.value !== null &&
      state.api.process.instance.variables.value.data !== null &&
      state.api.process.instance.variables.value.data !== undefined;

  const load = () =>
    void engine_rest.process_instance.variables(state, params.selection_id);

  useEffect(() => {
    if (!history_mode) {
      load();
    } else {
      void engine_rest.history.variable_instance.by_process_instance(
        state,
        params.selection_id,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  const open_add = () => {
    edit_new.value = true;
    edit_name.value = "";
    edit_type.value = "String";
    edit_value.value = "";
    edit_open.value = true;
  };

  const open_edit = (name, type, value) => {
    edit_new.value = false;
    edit_name.value = name;
    edit_type.value = type ?? "String";
    edit_value.value = value ?? "";
    edit_open.value = true;
  };

  const save_variable = async () => {
    await engine_rest.process_instance.set_variable(
      state,
      params.selection_id,
      edit_name.value,
      {
        value: coerce_variable_value(edit_type.value, edit_value.value),
        type: edit_type.value,
      },
    );
    edit_open.value = false;
    load();
  };

  const remove_variable = async () => {
    await engine_rest.process_instance.delete_variable(
      state,
      params.selection_id,
      delete_name.value,
    );
    load();
  };

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
                ).map(([name, { type, value }]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{type}</td>
                    <td>{String(value)}</td>
                    <td>
                      <div class="button-group">
                        <button
                          type="button"
                          onClick={() => open_edit(name, type, value)}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          class="danger"
                          onClick={() => {
                            delete_name.value = name;
                            delete_open.value = true;
                          }}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : state.api.process.instance.variables.value.data.map(
                  ({ name, type, value }) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{type}</td>
                      <td>{String(value)}</td>
                      <td />
                    </tr>
                  ),
                )
            : t("common.loading")}
        </tbody>
      </table>
      {!history_mode && (
        <div class="button-group">
          <button type="button" onClick={open_add}>
            {t("processes.variables.add")}
          </button>
        </div>
      )}
      <Dialog
        open={edit_open}
        title={
          edit_new.value
            ? t("processes.variables.add")
            : t("processes.variables.edit")
        }
      >
        <div class="dialog-fields">
          <label>
            {t("common.name")}
            <input
              type="text"
              value={edit_name.value}
              disabled={!edit_new.value}
              onInput={(e) => (edit_name.value = e.target.value)}
            />
          </label>
          <label>
            {t("common.type")}
            <select
              value={edit_type.value}
              onChange={(e) => (edit_type.value = e.target.value)}
            >
              {VARIABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.value")}
            <input
              type="text"
              value={edit_value.value}
              onInput={(e) => (edit_value.value = e.target.value)}
            />
          </label>
        </div>
        <div class="button-group">
          <button
            type="button"
            onClick={save_variable}
            disabled={!edit_name.value}
          >
            {t("common.save")}
          </button>
          <button type="button" onClick={() => (edit_open.value = false)}>
            {t("common.cancel")}
          </button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={delete_open}
        message={t("processes.variables.confirm-delete", {
          name: delete_name.value,
        })}
        confirm_label={t("common.delete")}
        on_confirm={remove_variable}
      />
    </div>
  );
};

const InstanceIncidents = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation(),
    annotation_open = useSignal(false),
    annotation_id = useSignal(null),
    annotation_text = useSignal("");

  // Live incidents (`/incident`) are actionable; history mode falls back to the
  // read-only `/history/incident` audit view.
  const load = () => {
    if (history_mode) {
      void engine_rest.history.incident.by_process_instance(
        state,
        params.selection_id,
      );
    } else {
      void engine_rest.incident.by_process_instance(state, params.selection_id);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  const rows =
    (history_mode
      ? state.api.history.incident.by_process_instance.value?.data
      : state.api.incident.by_process_instance.value?.data) ?? [];

  // For failedJob incidents the `configuration` field carries the jobId; a retry
  // resets its retries to 1 so the engine picks it up again.
  const retry = async (configuration) => {
    await engine_rest.job.set_retries(state, configuration, 1);
    load();
  };

  const open_annotation = (id, current) => {
    annotation_id.value = id;
    annotation_text.value = current ?? "";
    annotation_open.value = true;
  };

  const save_annotation = async () => {
    await engine_rest.incident.set_annotation(
      state,
      annotation_id.value,
      annotation_text.value,
    );
    annotation_open.value = false;
    load();
  };

  /** @namespace state.api.incident.by_process_instance.value.data **/
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
          {rows.map((incident) => {
            const timestamp = incident.createTime ?? incident.incidentTimestamp;
            return (
              <tr key={incident.id}>
                <td>{incident.incidentMessage}</td>
                <td>
                  <UUIDLink
                    path={"/processes"}
                    uuid={incident.processInstanceId}
                  />
                </td>
                <td>
                  <time datetime={timestamp}>
                    {timestamp ? timestamp.substring(0, 19) : "-/-"}
                  </time>
                </td>
                <td>{incident.activityId}</td>
                <td>{incident.failedActivityId}</td>
                <td>
                  <UUIDLink path={""} uuid={incident.causeIncidentId} />
                </td>
                <td>
                  <UUIDLink path={""} uuid={incident.rootCauseIncidentId} />
                </td>
                <td>{incident.incidentType}</td>
                <td>{incident.annotation}</td>
                <td>
                  {!history_mode && (
                    <div class="button-group">
                      {incident.incidentType === "failedJob" &&
                        incident.configuration && (
                          <button
                            type="button"
                            onClick={() => retry(incident.configuration)}
                          >
                            {t("processes.incidents.retry")}
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() =>
                          open_annotation(incident.id, incident.annotation)
                        }
                      >
                        {t("processes.incidents.set-annotation")}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Dialog
        open={annotation_open}
        title={t("processes.incidents.annotation")}
      >
        <label>
          {t("processes.incidents.annotation")}
          <textarea
            value={annotation_text.value}
            onInput={(e) => (annotation_text.value = e.target.value)}
            placeholder={t("processes.incidents.annotation-placeholder")}
          />
        </label>
        <div class="button-group">
          <button type="button" onClick={save_annotation}>
            {t("common.save")}
          </button>
          <button type="button" onClick={() => (annotation_open.value = false)}>
            {t("common.cancel")}
          </button>
        </div>
      </Dialog>
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
    ? (state.api.history.task.by_process_instance.value?.data ?? []).map(
        (t) => ({
          ...t,
          created: t.startTime,
          delegationState: t.delegationState ?? null,
        }),
      )
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
                  <button type="button">
                    {t("processes.user-tasks.groups")}
                  </button>
                  <button type="button">
                    {t("processes.user-tasks.users")}
                  </button>
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
  const rows =
    (history_mode
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
            const definition_id =
              instance.processDefinitionId ?? instance.definitionId;
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
    { definition_id, query } = useRoute(),
    history_mode = query?.history === "true",
    [t] = useTranslation(),
    annotation_open = useSignal(false),
    annotation_id = useSignal(null),
    annotation_text = useSignal("");

  // Live incidents (`/incident`) are actionable; history mode falls back to the
  // read-only `/history/incident` audit view.
  const load = () => {
    if (history_mode) {
      void engine_rest.history.incident.by_process_definition(
        state,
        definition_id,
      );
    } else {
      void engine_rest.incident.by_process_definition(state, definition_id);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition_id, history_mode]);

  const rows =
    (history_mode
      ? state.api.history.incident.by_process_definition.value?.data
      : state.api.incident.by_process_definition.value?.data) ?? [];

  const retry = async (configuration) => {
    await engine_rest.job.set_retries(state, configuration, 1);
    load();
  };

  const open_annotation = (id, current) => {
    annotation_id.value = id;
    annotation_text.value = current ?? "";
    annotation_open.value = true;
  };

  const save_annotation = async () => {
    await engine_rest.incident.set_annotation(
      state,
      annotation_id.value,
      annotation_text.value,
    );
    annotation_open.value = false;
    load();
  };

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
            <th>{t("processes.incidents.annotation")}</th>
            <th>{t("common.action")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((incident) => (
            <tr key={incident.id}>
              <td>{incident.incidentMessage}</td>
              <td>{incident.incidentType}</td>
              <td>{incident.configuration}</td>
              <td>{incident.annotation}</td>
              <td>
                {!history_mode && (
                  <div class="button-group">
                    {incident.incidentType === "failedJob" &&
                      incident.configuration && (
                        <button
                          type="button"
                          onClick={() => retry(incident.configuration)}
                        >
                          {t("processes.incidents.retry")}
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() =>
                        open_annotation(incident.id, incident.annotation)
                      }
                    >
                      {t("processes.incidents.set-annotation")}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Dialog
        open={annotation_open}
        title={t("processes.incidents.annotation")}
      >
        <div class="dialog-fields">
          <label>
            {t("processes.incidents.annotation")}
            <textarea
              value={annotation_text.value}
              onInput={(e) => (annotation_text.value = e.target.value)}
              placeholder={t("processes.incidents.annotation-placeholder")}
            />
          </label>
        </div>
        <div class="button-group">
          <button type="button" onClick={save_annotation}>
            {t("common.save")}
          </button>
          <button type="button" onClick={() => (annotation_open.value = false)}>
            {t("common.cancel")}
          </button>
        </div>
      </Dialog>
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
    [t] = useTranslation(),
    priority_open = useSignal(false),
    retries_open = useSignal(false),
    target_id = useSignal(null),
    input_value = useSignal("");

  const load = () =>
    void engine_rest.job_definition.all.by_process_definition(
      state,
      definition_id,
    );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition_id]);

  const toggle_suspended = async (id, suspended) => {
    await engine_rest.job_definition.set_suspended(state, id, suspended);
    load();
  };

  const save_priority = async () => {
    await engine_rest.job_definition.set_priority(
      state,
      target_id.value,
      parseInt(input_value.value, 10),
    );
    priority_open.value = false;
    load();
  };

  const save_retries = async () => {
    await engine_rest.job_definition.set_retries(
      state,
      target_id.value,
      parseInt(input_value.value, 10),
    );
    retries_open.value = false;
    load();
  };

  /** @namespace state.api.job_definition.all.by_process_definition.value.data **/
  /** @namespace definition.jobType **/
  /** @namespace definition.jobConfiguration **/
  /** @namespace definition.overridingJobPriority **/
  return (
    <div class="relative">
      {history_mode && (
        <small class="history-na">{t("processes.history-mode-na")}</small>
      )}
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
              <tr key={definition.id}>
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
                  {!history_mode && (
                    <div class="button-group">
                      {definition.suspended ? (
                        <button
                          type="button"
                          onClick={() => toggle_suspended(definition.id, false)}
                        >
                          {t("common.activate")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle_suspended(definition.id, true)}
                        >
                          {t("processes.jobs.suspend")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          target_id.value = definition.id;
                          input_value.value = String(
                            definition.overridingJobPriority ?? "",
                          );
                          priority_open.value = true;
                        }}
                      >
                        {t("processes.jobs.change-priority")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          target_id.value = definition.id;
                          input_value.value = "";
                          retries_open.value = true;
                        }}
                      >
                        {t("processes.jobs.set-retries")}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <Dialog open={priority_open} title={t("processes.jobs.change-priority")}>
        <div class="dialog-fields">
          <label>
            {t("processes.jobs.overriding-job-priority")}
            <input
              type="number"
              value={input_value.value}
              onInput={(e) => (input_value.value = e.target.value)}
            />
          </label>
        </div>
        <div class="button-group">
          <button
            type="button"
            onClick={save_priority}
            disabled={input_value.value === ""}
          >
            {t("common.save")}
          </button>
          <button type="button" onClick={() => (priority_open.value = false)}>
            {t("common.cancel")}
          </button>
        </div>
      </Dialog>
      <Dialog open={retries_open} title={t("processes.jobs.set-retries")}>
        <div class="dialog-fields">
          <label>
            {t("processes.jobs.retries")}
            <input
              type="number"
              min="0"
              value={input_value.value}
              onInput={(e) => (input_value.value = e.target.value)}
            />
          </label>
        </div>
        <div class="button-group">
          <button
            type="button"
            onClick={save_retries}
            disabled={input_value.value === ""}
          >
            {t("common.save")}
          </button>
          <button type="button" onClick={() => (retries_open.value = false)}>
            {t("common.cancel")}
          </button>
        </div>
      </Dialog>
    </div>
  );
};

const BackToListBtn = ({ url, title, className }) => (
  <a
    class={`tabs-back ${className || ""}`}
    href={url}
    title={title}
    aria-label={title}
  >
    <Icons.arrow_left />
    <Icons.list />
  </a>
);

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

// Format a <input type="datetime-local"> value into the engine's expected
// `yyyy-MM-dd'T'HH:mm:ss.SSSZ` shape (UTC / +0000 offset).
const to_engine_datetime = (local) => {
  const d = new Date(local),
    pad = (n, l = 2) => String(n).padStart(l, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
    `.${pad(d.getUTCMilliseconds(), 3)}+0000`
  );
};

const InstanceJobs = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation(),
    duedate_open = useSignal(false),
    duedate_id = useSignal(null),
    duedate_value = useSignal("");

  const load = () =>
    void engine_rest.job.by_process_instance(state, params.selection_id);

  useEffect(() => {
    if (!history_mode) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  const retry = async (id) => {
    await engine_rest.job.set_retries(state, id, 1);
    load();
  };

  const toggle_suspended = async (id, suspended) => {
    await engine_rest.job.set_suspended(state, id, suspended);
    load();
  };

  const save_duedate = async () => {
    await engine_rest.job.set_duedate(
      state,
      duedate_id.value,
      to_engine_datetime(duedate_value.value),
    );
    duedate_open.value = false;
    load();
  };

  /** @namespace state.api.job.by_process_instance.value.data **/
  return (
    <div>
      {history_mode && (
        <small class="history-na">{t("processes.history-mode-na")}</small>
      )}
      <table>
        <thead>
          <tr>
            <th>{t("processes.jobs.job-id")}</th>
            <th>{t("processes.jobs.due-date")}</th>
            <th>{t("processes.jobs.retries")}</th>
            <th>{t("common.state")}</th>
            <th>{t("processes.jobs.exception")}</th>
            <th>{t("common.action")}</th>
          </tr>
        </thead>
        <tbody>
          {state.api.job.by_process_instance.value?.data?.map((job) => (
            <tr key={job.id}>
              <td class="font-mono">{job.id?.substring(0, 8)}</td>
              <td>
                {job.dueDate ? (
                  <time datetime={job.dueDate}>
                    {job.dueDate.substring(0, 19)}
                  </time>
                ) : (
                  "—"
                )}
              </td>
              <td>{job.retries}</td>
              <td>
                {job.suspended ? t("common.suspended") : t("common.active")}
              </td>
              <td>{job.exceptionMessage}</td>
              <td>
                {!history_mode && (
                  <div class="button-group">
                    <button type="button" onClick={() => retry(job.id)}>
                      {t("processes.jobs.retry")}
                    </button>
                    {job.suspended ? (
                      <button
                        type="button"
                        onClick={() => toggle_suspended(job.id, false)}
                      >
                        {t("common.activate")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle_suspended(job.id, true)}
                      >
                        {t("processes.jobs.suspend")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        duedate_id.value = job.id;
                        duedate_value.value = "";
                        duedate_open.value = true;
                      }}
                    >
                      {t("processes.jobs.set-due-date")}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Dialog open={duedate_open} title={t("processes.jobs.set-due-date")}>
        <label>
          {t("processes.jobs.due-date")}
          <input
            type="datetime-local"
            value={duedate_value.value}
            onInput={(e) => (duedate_value.value = e.target.value)}
          />
        </label>
        <div class="button-group">
          <button
            type="button"
            onClick={save_duedate}
            disabled={!duedate_value.value}
          >
            {t("common.save")}
          </button>
          <button type="button" onClick={() => (duedate_open.value = false)}>
            {t("common.cancel")}
          </button>
        </div>
      </Dialog>
    </div>
  );
};

const InstanceExternalTasks = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    history_mode = query.history === "true",
    [t] = useTranslation();

  const load = () =>
    void engine_rest.external_task.by_process_instance(
      state,
      params.selection_id,
    );

  useEffect(() => {
    if (!history_mode) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selection_id, history_mode]);

  const retry = async (id) => {
    await engine_rest.external_task.set_retries(state, id, 1);
    load();
  };

  const unlock = async (id) => {
    await engine_rest.external_task.unlock(state, id);
    load();
  };

  /** @namespace state.api.external_task.by_process_instance.value.data **/
  return (
    <div>
      {history_mode && (
        <small class="history-na">{t("processes.history-mode-na")}</small>
      )}
      <table>
        <thead>
          <tr>
            <th>{t("processes.external-tasks.topic")}</th>
            <th>{t("processes.external-tasks.worker")}</th>
            <th>{t("common.activity")}</th>
            <th>{t("processes.jobs.retries")}</th>
            <th>{t("processes.external-tasks.lock-expiration")}</th>
            <th>{t("processes.jobs.exception")}</th>
            <th>{t("common.action")}</th>
          </tr>
        </thead>
        <tbody>
          {state.api.external_task.by_process_instance.value?.data?.map(
            (task) => (
              <tr key={task.id}>
                <td>{task.topicName}</td>
                <td>{task.workerId ?? "—"}</td>
                <td>{task.activityId}</td>
                <td>{task.retries ?? "—"}</td>
                <td>
                  {task.lockExpirationTime ? (
                    <time datetime={task.lockExpirationTime}>
                      {task.lockExpirationTime.substring(0, 19)}
                    </time>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{task.errorMessage}</td>
                <td>
                  {!history_mode && (
                    <div class="button-group">
                      <button type="button" onClick={() => retry(task.id)}>
                        {t("processes.jobs.retry")}
                      </button>
                      {task.workerId && (
                        <button type="button" onClick={() => unlock(task.id)}>
                          {t("processes.external-tasks.unlock")}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

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
    Component: InstanceJobs,
  },
  {
    nameKey: "processes.tabs.external-tasks",
    id: "external_tasks",
    pos: 5,
    Component: InstanceExternalTasks,
  },
];

// fixme : extract to util file
const copyToClipboard = (event) =>
  navigator.clipboard.writeText(event.target.innerText);

export { ProcessesPage };
