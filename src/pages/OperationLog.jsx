import { useSignal } from "@preact/signals";
import { useContext, useEffect } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { useTranslation } from "react-i18next";
import engine_rest, { RequestState } from "../api/engine_rest.jsx";
import { Dialog } from "../components/Dialog.jsx";
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
import { AppState } from "../state.js";

const RESOURCE_TYPE = "operation_log";

const SORT_OPTIONS = [
  { key: "timestamp", nameKey: "operation_log.sort.timestamp" },
  { key: "operationId", nameKey: "operation_log.sort.operationId" },
  { key: "userId", nameKey: "operation_log.sort.userId" },
  { key: "operationType", nameKey: "operation_log.sort.operationType" },
  { key: "entityType", nameKey: "operation_log.sort.entityType" },
  { key: "category", nameKey: "operation_log.sort.category" },
];

const FILTER_KEYS = [
  {
    key: "userId",
    nameKey: "operation_log.filter_keys.userId",
    type: "string",
  },
  {
    key: "operationType",
    nameKey: "operation_log.filter_keys.operationType",
    type: "string",
  },
  {
    key: "entityType",
    nameKey: "operation_log.filter_keys.entityType",
    type: "string",
  },
  {
    key: "category",
    nameKey: "operation_log.filter_keys.category",
    type: "string",
  },
  {
    key: "timestampAfter",
    nameKey: "operation_log.filter_keys.timestampAfter",
    type: "date",
  },
  {
    key: "timestampBefore",
    nameKey: "operation_log.filter_keys.timestampBefore",
    type: "date",
  },
  {
    key: "processInstanceId",
    nameKey: "operation_log.filter_keys.processInstanceId",
    type: "string",
  },
  {
    key: "processDefinitionId",
    nameKey: "operation_log.filter_keys.processDefinitionId",
    type: "string",
  },
  {
    key: "taskId",
    nameKey: "operation_log.filter_keys.taskId",
    type: "string",
  },
  {
    key: "operationId",
    nameKey: "operation_log.filter_keys.operationId",
    type: "string",
  },
];

const DEFAULTS = { sortBy: "timestamp", sortOrder: "desc" };

const find_saved = (signal, id) => {
  if (!id || id === "all") return null;
  return (signal.value?.data ?? []).find((f) => f.id === id) ?? null;
};

const timestamp_param = (value, edge) => {
  if (!value) return value;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  if (value.includes("T")) {
    if (value.includes(".")) return `${value}+0000`;
    if (/T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}.000+0000`;
    return `${value}:00.000+0000`;
  }
  return edge === "before"
    ? `${value}T23:59:59.999+0000`
    : `${value}T00:00:00.000+0000`;
};

const params_from_query = (state, query) => {
  const { saved_filter_id, sortBy, sortOrder, criteria } =
      parse_list_query(query),
    saved = find_saved(
      state.api.history.operation_log.saved_filters,
      saved_filter_id,
    ),
    params = {
      ...(saved?.query ?? {}),
      ...criteria,
      ...(sortBy ? { sortBy } : {}),
      ...(sortOrder ? { sortOrder } : {}),
    };

  if (params.timestampAfter)
    params.timestampAfter = timestamp_param(params.timestampAfter, "after");
  if (params.timestampBefore)
    params.timestampBefore = timestamp_param(params.timestampBefore, "before");

  return params;
};

const load_operation_log = (state, query, firstResult = 0) => {
  const params = params_from_query(state, query);
  void engine_rest.history.operation_log.all(state, params, firstResult);
  if (firstResult === 0)
    void engine_rest.history.operation_log.count(state, params);
};

const group_operations = (entries = []) => {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = entry.operationId ?? entry.id;
    if (!groups.has(key)) {
      groups.set(key, {
        operationId: key,
        userId: entry.userId,
        timestamp: entry.timestamp,
        annotation: entry.annotation,
        entries: [],
      });
    }
    const group = groups.get(key);
    group.entries.push(entry);
    group.userId = group.userId ?? entry.userId;
    group.timestamp = group.timestamp ?? entry.timestamp;
    group.annotation = group.annotation ?? entry.annotation;
  });
  return Array.from(groups.values());
};

const unique_join = (entries, key) =>
  [...new Set(entries.map((entry) => entry[key]).filter(Boolean))].join(", ") ||
  "—";

const OperationLogPage = () => {
  const state = useContext(AppState),
    { query } = useRoute(),
    [t] = useTranslation();

  useEffect(() => {
    hydrate_signal(
      RESOURCE_TYPE,
      state.api.history.operation_log.saved_filters,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load_operation_log(state, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  if (query.filters === "manage") return <OperationLogManage />;

  return (
    <main id="content" class="operation-log fade-in">
      <header>
        <div>
          <h1>{t("operation_log.title")}</h1>
          <OperationLogCount />
        </div>
        <button
          type="button"
          class="secondary"
          onClick={() => load_operation_log(state, query)}
        >
          {t("operation_log.refresh")}
        </button>
      </header>
      <OperationLogFilters />
      <OperationLogTable />
    </main>
  );
};

const OperationLogCount = () => {
  const state = useContext(AppState),
    [t] = useTranslation();
  return (
    <RequestState
      signal={state.api.history.operation_log.count}
      on_success={() => (
        <p>
          {t("operation_log.matching-entries", {
            count:
              state.api.history.operation_log.count.value?.data?.count ?? 0,
          })}
        </p>
      )}
      on_load={<p>{t("common.loading")}</p>}
    />
  );
};

const OperationLogFilters = () => {
  const state = useContext(AppState),
    { query } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    parsed = parse_list_query(query),
    list_current = {
      saved_filter_id: parsed.saved_filter_id,
      sortBy: parsed.sortBy ?? DEFAULTS.sortBy,
      sortOrder: parsed.sortOrder ?? DEFAULTS.sortOrder,
      criteria: parsed.criteria,
    },
    apply_patch = (patch) =>
      route(write_list_query(window.location.href, patch), true),
    criteria = parsed.criteria;

  const submit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    apply_patch({
      criteria: {
        userId: form.elements.userId.value,
        operationType: form.elements.operationType.value,
        timestampAfter: form.elements.timestampAfter.value,
        timestampBefore: form.elements.timestampBefore.value,
      },
    });
  };

  return (
    <>
      <form class="operation-log-filter" onSubmit={submit}>
        <label>
          {t("operation_log.filters.user")}
          <input name="userId" value={criteria.userId ?? ""} />
        </label>
        <label>
          {t("operation_log.filters.operation")}
          <input name="operationType" value={criteria.operationType ?? ""} />
        </label>
        <label>
          {t("operation_log.filters.after")}
          <input
            name="timestampAfter"
            type="datetime-local"
            value={criteria.timestampAfter ?? ""}
          />
        </label>
        <label>
          {t("operation_log.filters.before")}
          <input
            name="timestampBefore"
            type="datetime-local"
            value={criteria.timestampBefore ?? ""}
          />
        </label>
        <div class="button-group">
          <button type="submit">{t("operation_log.apply-filters")}</button>
          <button
            type="button"
            class="secondary"
            onClick={() => apply_patch({ criteria: {} })}
          >
            {t("operation_log.clear-filters")}
          </button>
        </div>
      </form>
      <ListFilter
        sort_options={SORT_OPTIONS}
        saved_filters_signal={state.api.history.operation_log.saved_filters}
        current={list_current}
        defaults={DEFAULTS}
        on_change={apply_patch}
        on_manage={() => route(with_manage(), false)}
      />
    </>
  );
};

const OperationLogTable = () => {
  const state = useContext(AppState),
    { query } = useRoute(),
    [t] = useTranslation(),
    list = state.api.history.operation_log.list,
    edit_open = useSignal(false),
    editing = useSignal(null),
    annotation = useSignal("");

  const open_annotation = (group) => {
    editing.value = group;
    annotation.value = group.annotation ?? "";
    edit_open.value = true;
  };

  const reload = () => load_operation_log(state, query);

  const submit_annotation = async (event) => {
    event.preventDefault();
    await engine_rest.history.operation_log.set_annotation(
      state,
      editing.value.operationId,
      annotation.value,
    );
    edit_open.value = false;
    reload();
  };

  const clear_annotation = async () => {
    await engine_rest.history.operation_log.clear_annotation(
      state,
      editing.value.operationId,
    );
    edit_open.value = false;
    reload();
  };

  const load_more = () =>
    load_operation_log(state, query, list.value?.data?.length ?? 0);

  return (
    <>
      <RequestState
        signal={list}
        on_success={() => {
          const groups = group_operations(list.value?.data ?? []);
          if (groups.length === 0)
            return <p class="info-box">{t("operation_log.empty")}</p>;

          return (
            <div>
              <table>
                <thead>
                  <tr>
                    <th>{t("operation_log.timestamp")}</th>
                    <th>{t("operation_log.user")}</th>
                    <th>{t("operation_log.operation")}</th>
                    <th>{t("operation_log.entity")}</th>
                    <th>{t("operation_log.annotation")}</th>
                    <th>{t("common.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <OperationGroupRow
                      key={group.operationId}
                      group={group}
                      on_annotate={open_annotation}
                    />
                  ))}
                </tbody>
              </table>
              {list.value?.hasMore ? (
                <button type="button" class="load-more" onClick={load_more}>
                  {t("tasks.load-more")}
                </button>
              ) : (
                <small class="load-more-end">{t("tasks.no-more-items")}</small>
              )}
            </div>
          );
        }}
      />
      <Dialog open={edit_open} title={t("operation_log.annotation-title")}>
        <form onSubmit={submit_annotation} class="operation-log-annotation">
          <label>
            {t("operation_log.annotation")}
            <textarea
              value={annotation.value}
              onInput={(event) =>
                (annotation.value = event.currentTarget.value)
              }
            />
          </label>
          <div class="button-group">
            <button type="submit">{t("common.save")}</button>
            <button type="button" class="secondary" onClick={clear_annotation}>
              {t("operation_log.clear-annotation")}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
};

const OperationGroupRow = ({ group, on_annotate }) => {
  const [t] = useTranslation(),
    timestamp = group.timestamp ? new Date(group.timestamp) : null;

  return (
    <>
      <tr>
        <td>
          {timestamp ? (
            <time datetime={group.timestamp}>{timestamp.toLocaleString()}</time>
          ) : (
            "—"
          )}
        </td>
        <td>{group.userId ?? "—"}</td>
        <td>{unique_join(group.entries, "operationType")}</td>
        <td>
          <EntityLinks entries={group.entries} />
        </td>
        <td>{group.annotation ?? "—"}</td>
        <td>
          <button type="button" onClick={() => on_annotate(group)}>
            {t("operation_log.annotate")}
          </button>
        </td>
      </tr>
      <tr>
        <td colspan="6">
          <details>
            <summary>{t("operation_log.details")}</summary>
            <table>
              <thead>
                <tr>
                  <th>{t("operation_log.property")}</th>
                  <th>{t("operation_log.original-value")}</th>
                  <th>{t("operation_log.new-value")}</th>
                  <th>{t("operation_log.entity")}</th>
                  <th>{t("operation_log.category")}</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry, index) => (
                  <tr key={`${group.operationId}-${entry.id ?? index}`}>
                    <td>{entry.property ?? "—"}</td>
                    <td>{entry.orgValue ?? "—"}</td>
                    <td>{entry.newValue ?? "—"}</td>
                    <td>{entry.entityType ?? "—"}</td>
                    <td>{entry.category ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </td>
      </tr>
    </>
  );
};

const EntityLinks = ({ entries }) => {
  const entry = entries.find((item) => item.processInstanceId) ?? entries[0],
    task = entries.find((item) => item.taskId),
    processDefinitionId = entry?.processDefinitionId,
    processInstanceId = entry?.processInstanceId;

  return (
    <span class="operation-log-entities">
      {processInstanceId && processDefinitionId ? (
        <a
          href={`/processes/${processDefinitionId}/instances/${processInstanceId}/vars?history=true`}
        >
          {processInstanceId}
        </a>
      ) : processDefinitionId ? (
        <a href={`/processes/${processDefinitionId}`}>{processDefinitionId}</a>
      ) : (
        "—"
      )}
      {task?.taskId ? (
        <a href={`/tasks/${task.taskId}/form`}>{task.taskId}</a>
      ) : null}
    </span>
  );
};

const OperationLogManage = () => {
  const state = useContext(AppState),
    { route } = useLocation(),
    [t] = useTranslation(),
    refresh = () =>
      hydrate_signal(
        RESOURCE_TYPE,
        state.api.history.operation_log.saved_filters,
      );

  return (
    <main id="content">
      <ManageFilters
        title={t("operation_log.filter.manage_title")}
        saved_filters_signal={state.api.history.operation_log.saved_filters}
        filter_keys={FILTER_KEYS}
        sort_options={SORT_OPTIONS}
        on_save={(filter) => {
          create_saved_filter(RESOURCE_TYPE, filter);
          refresh();
        }}
        on_update={(id, filter) => {
          update_saved_filter(RESOURCE_TYPE, id, filter);
          refresh();
        }}
        on_delete={(id) => {
          delete_saved_filter(RESOURCE_TYPE, id);
          refresh();
        }}
        on_close={() => route(without_manage(), true)}
        build_share_link={(filter) =>
          filter_share_link(window.location.href, filter)
        }
      />
    </main>
  );
};

export { OperationLogPage };
