import { useContext, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { useTranslation } from "react-i18next";
import { useLocation, useRoute } from "preact-iso";
import { AppState } from "../state.js";
import engine_rest, { RequestState } from "../api/engine_rest.jsx";
import { ConfirmDialog } from "../components/Dialog.jsx";
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

const RESOURCE_TYPE = "batch";

const SORT_OPTIONS = [
  { key: "batchId", nameKey: "batches.sort.batchId" },
  { key: "tenantId", nameKey: "batches.sort.tenantId" },
];

const FILTER_KEYS = [
  { key: "batchId", nameKey: "batches.filter_keys.batchId", type: "string" },
  { key: "type", nameKey: "batches.filter_keys.type", type: "string" },
  { key: "tenantIdIn", nameKey: "batches.filter_keys.tenantIdIn", type: "string" },
  { key: "suspended", nameKey: "batches.filter_keys.suspended", type: "boolean" },
  { key: "withoutTenantId", nameKey: "batches.filter_keys.withoutTenantId", type: "boolean" },
];

const BATCH_DEFAULTS = { sortBy: "batchId", sortOrder: "desc" };

const find_saved = (signal, id) => {
  if (!id || id === "all") return null;
  return (signal.value?.data ?? []).find((f) => f.id === id) ?? null;
};

const load_batches = (state, query, firstResult = 0) => {
  const { saved_filter_id, sortBy, sortOrder, criteria } = parse_list_query(query);
  const saved = find_saved(state.api.batch.saved_filters, saved_filter_id);
  const params = {
    ...BATCH_DEFAULTS,
    ...(saved?.query ?? {}),
    ...criteria,
    ...(sortBy ? { sortBy } : {}),
    ...(sortOrder ? { sortOrder } : {}),
  };
  void engine_rest.batch.all(state, params, firstResult);
};

const BatchesPage = () => {
  const state = useContext(AppState),
    {
      params: { batch_id },
      query,
    } = useRoute(),
    [t] = useTranslation();

  useEffect(() => {
    hydrate_signal(RESOURCE_TYPE, state.api.batch.saved_filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load_batches(state, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  // Load the selected batch's statistics; clear on navigation.
  useEffect(() => {
    if (batch_id) {
      void engine_rest.batch.one(state, batch_id);
    }
    return () => {
      state.api.batch.one.value = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch_id]);

  return (
    <main id="content" class="batches fade-in">
      <BatchesList />
      {batch_id ? (
        <BatchDetails />
      ) : (
        <div class="batch-empty">{t("batches.select-batch")}</div>
      )}
    </main>
  );
};

const Progress = ({ batch }) => {
  const total = batch.totalJobs ?? 0,
    completed = batch.completedJobs ?? 0;
  return (
    <>
      <progress value={completed} max={total || 1} /> {completed}/{total}
    </>
  );
};

const BatchesList = () => {
  const state = useContext(AppState),
    { params, query } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation();

  const parsed = parse_list_query(query);
  const list_current = {
    saved_filter_id: parsed.saved_filter_id,
    sortBy: parsed.sortBy ?? BATCH_DEFAULTS.sortBy,
    sortOrder: parsed.sortOrder ?? BATCH_DEFAULTS.sortOrder,
    criteria: parsed.criteria,
  };

  const apply_patch = (patch) => {
    route(write_list_query(window.location.href, patch), true);
  };
  const open_manage = () => route(with_manage(), false);

  if (query?.filters === "manage") return <BatchesManage />;

  return (
    <div>
      <header>
        <h1>{t("batches.title")}</h1>
        <button
          type="button"
          class="secondary"
          onClick={() => load_batches(state, query)}
        >
          {t("batches.refresh")}
        </button>
      </header>
      <ListFilter
        sort_options={SORT_OPTIONS}
        saved_filters_signal={state.api.batch.saved_filters}
        current={list_current}
        defaults={BATCH_DEFAULTS}
        on_change={apply_patch}
        on_manage={open_manage}
      />
      <RequestState
        signal={state.api.batch.list}
        on_success={() => {
          const rows = state.api.batch.list.value?.data ?? [];
          if (rows.length === 0)
            return <p class="info-box">{t("batches.empty")}</p>;
          return (
            <table>
              <thead>
                <tr>
                  <th>{t("batches.id")}</th>
                  <th>{t("batches.type")}</th>
                  <th>{t("batches.progress")}</th>
                  <th class="num">{t("batches.failed-jobs")}</th>
                  <th>{t("batches.state")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((batch) => (
                  <tr
                    key={batch.id}
                    aria-selected={params.batch_id === batch.id}
                  >
                    <th scope="row">
                      <a href={`/batches/${batch.id}`}>
                        {batch.id.substring(0, 8)}
                      </a>
                    </th>
                    <td>{batch.type}</td>
                    <td>
                      <Progress batch={batch} />
                    </td>
                    <td class="num">{batch.failedJobs ?? 0}</td>
                    <td>
                      {batch.suspended
                        ? t("batches.suspended")
                        : t("batches.running")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }}
      />
    </div>
  );
};

const BatchDetails = () => {
  const state = useContext(AppState),
    {
      params: { batch_id },
    } = useRoute(),
    [t] = useTranslation(),
    confirm_delete = useSignal(false);

  const reload = () => {
    void engine_rest.batch.one(state, batch_id);
    void engine_rest.batch.all(state);
  };

  const toggle_suspended = async (suspended) => {
    await engine_rest.batch.set_suspended(state, batch_id, suspended);
    reload();
  };

  const remove = async () => {
    await engine_rest.batch.delete(state, batch_id);
    void engine_rest.batch.all(state);
  };

  return (
    <div id="batch-details">
      <RequestState
        signal={state.api.batch.one}
        on_nothing={() => <p class="info-box">{t("batches.select-batch")}</p>}
        on_success={() => {
          const batch = state.api.batch.one.value?.data?.[0];
          if (!batch) return <p class="info-box">{t("batches.empty")}</p>;
          return (
            <div>
              <header>
                <h1>{batch.id}</h1>
              </header>
              <dl>
                <dt>{t("batches.type")}</dt>
                <dd>{batch.type}</dd>
                <dt>{t("batches.progress")}</dt>
                <dd>
                  <Progress batch={batch} />
                </dd>
                <dt>{t("batches.total-jobs")}</dt>
                <dd>{batch.totalJobs ?? 0}</dd>
                <dt>{t("batches.remaining-jobs")}</dt>
                <dd>{batch.remainingJobs ?? 0}</dd>
                <dt>{t("batches.failed-jobs")}</dt>
                <dd>{batch.failedJobs ?? 0}</dd>
                <dt>{t("batches.created-by")}</dt>
                <dd>{batch.createUserId ?? "—"}</dd>
                <dt>{t("batches.state")}</dt>
                <dd>
                  {batch.suspended
                    ? t("batches.suspended")
                    : t("batches.running")}
                </dd>
              </dl>
              <div class="button-group">
                {batch.suspended ? (
                  <button type="button" onClick={() => toggle_suspended(false)}>
                    {t("batches.resume")}
                  </button>
                ) : (
                  <button type="button" onClick={() => toggle_suspended(true)}>
                    {t("batches.suspend")}
                  </button>
                )}
                <button
                  type="button"
                  class="danger"
                  onClick={() => (confirm_delete.value = true)}
                >
                  {t("batches.delete")}
                </button>
              </div>
              <ConfirmDialog
                open={confirm_delete}
                message={t("batches.confirm-delete")}
                confirm_label={t("batches.delete")}
                on_confirm={remove}
              />
            </div>
          );
        }}
      />
    </div>
  );
};

const BatchesManage = () => {
  const state = useContext(AppState),
    { route } = useLocation(),
    [t] = useTranslation();

  const refresh = () =>
    hydrate_signal(RESOURCE_TYPE, state.api.batch.saved_filters);
  return (
    <div class="fade-in">
      <ManageFilters
        title={t("batches.filter.manage_title")}
        saved_filters_signal={state.api.batch.saved_filters}
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

export { BatchesPage };
