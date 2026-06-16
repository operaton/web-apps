import { useContext, useEffect } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { useTranslation } from "react-i18next";
import engine_rest, { RequestState } from "../api/engine_rest.jsx";
import { ListFilter } from "../components/ListFilter.jsx";
import { formatRelativeDate } from "../helper/date_formatter.js";
import {
  parse_list_query,
  with_manage,
  write_list_query,
} from "../helper/list_query.js";
import { AppState } from "../state.js";
import { TASK_PAGE_SIZE, TASK_SORT_OPTIONS, TasksManage } from "./Tasks.jsx";

const find_saved = (signal, id) => {
  if (!id || id === "all" || id === "my") return null;
  return (signal.value?.data ?? []).find((f) => f.id === id) ?? null;
};

const current_user_id = (state) =>
  state.api.user.profile.value?.id ??
  state.auth.user.id.value ??
  state.auth.credentials.value?.username;

const task_query_from_route = (state, query) => {
  const { saved_filter_id, criteria } = parse_list_query(query),
    saved = find_saved(state.api.filter.list, saved_filter_id),
    preset =
      saved_filter_id === "my" ? { assignee: current_user_id(state) } : {};

  return {
    ...preset,
    ...(saved?.query ?? {}),
    ...criteria,
  };
};

const load_results = (state, query, firstResult = 0) => {
  const { sortBy, sortOrder } = parse_list_query(query);
  void engine_rest.task.get_task_dashboard_results(
    state,
    task_query_from_route(state, query),
    sortBy ?? "name",
    sortOrder ?? "asc",
    firstResult,
    TASK_PAGE_SIZE,
  );
};

const TaskDashboardPage = () => {
  const state = useContext(AppState),
    { query } = useRoute(),
    [t] = useTranslation(),
    filter_status = state.api.filter.list.value?.status,
    groups = state.api.group.list.value?.data ?? [],
    group_ids = groups.map((group) => group.id).join(",");

  useEffect(() => {
    if (state.api.filter.list.value === null)
      void engine_rest.filter.get_filters(state);
    if (state.api.group.list.value === null) void engine_rest.group.all(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void engine_rest.task.get_task_dashboard_summary(state, groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group_ids]);

  useEffect(() => {
    load_results(state, query);
    // Reload once task filters are available because a saved filter id in the
    // URL has to be resolved before it can be executed as a query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query), filter_status]);

  if (query?.filters === "manage") {
    return (
      <main id="content" class="fade-in">
        <TasksManage />
      </main>
    );
  }

  return (
    <main id="content" class="task-dashboard fade-in">
      <header>
        <h1>{t("task_dashboard.title")}</h1>
        <a class="button secondary" href="/tasks">
          {t("task_dashboard.open-tasklist")}
        </a>
      </header>

      <section>
        <h2>{t("task_dashboard.assignment-by-type")}</h2>
        <TaskTypeSummary />
      </section>

      <section>
        <h2>{t("task_dashboard.assignment-by-group")}</h2>
        <GroupDistribution />
      </section>

      <section>
        <header>
          <h2>{t("task_dashboard.search.title")}</h2>
          <button
            type="button"
            class="secondary"
            onClick={() => load_results(state, query)}
          >
            {t("task_dashboard.search.refresh")}
          </button>
        </header>
        <TaskSearch />
      </section>
    </main>
  );
};

const SummaryCard = ({ href, value, label }) => (
  <a href={href}>
    <strong>{value}</strong>
    <span>{label}</span>
  </a>
);

const TaskTypeSummary = () => {
  const state = useContext(AppState),
    [t] = useTranslation();

  return (
    <RequestState
      signal={state.api.task.dashboard.summary}
      on_success={() => {
        const summary = state.api.task.dashboard.summary.value?.data;
        return (
          <div class="task-dashboard-summary">
            <SummaryCard
              href="/tasks-dashboard"
              value={summary.total}
              label={t("task_dashboard.summary.open")}
            />
            <SummaryCard
              href="/tasks-dashboard?q.assigned=true"
              value={summary.assigned}
              label={t("task_dashboard.summary.assigned")}
            />
            <SummaryCard
              href="/tasks-dashboard?q.unassigned=true"
              value={summary.unassigned}
              label={t("task_dashboard.summary.unassigned")}
            />
          </div>
        );
      }}
    />
  );
};

const GroupDistribution = () => {
  const state = useContext(AppState),
    [t] = useTranslation();

  return (
    <RequestState
      signal={state.api.task.dashboard.summary}
      on_success={() => {
        const groups = [
          ...(state.api.task.dashboard.summary.value?.data?.groups ?? []),
        ].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

        if (groups.length === 0)
          return <p class="info-box">{t("task_dashboard.groups.empty")}</p>;

        return (
          <table>
            <thead>
              <tr>
                <th>{t("task_dashboard.groups.group")}</th>
                <th class="num">{t("task_dashboard.groups.open-tasks")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <th scope="row">{group.name}</th>
                  <td class="num">
                    <a
                      href={`/tasks-dashboard?q.candidateGroup=${encodeURIComponent(group.id)}&q.includeAssignedTasks=true`}
                    >
                      {group.count}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }}
    />
  );
};

const TaskSearch = () => {
  const state = useContext(AppState),
    { query } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    parsed = parse_list_query(query),
    result_signal = state.api.task.dashboard.results,
    current = {
      saved_filter_id: parsed.saved_filter_id,
      sortBy: parsed.sortBy ?? "name",
      sortOrder: parsed.sortOrder ?? "asc",
      criteria: parsed.criteria,
    },
    apply_patch = (patch) => {
      route(write_list_query(window.location.href, patch), true);
    },
    load_more = () => {
      load_results(state, query, result_signal.value?.data?.length ?? 0);
    };

  return (
    <>
      <ListFilter
        sort_options={TASK_SORT_OPTIONS}
        saved_filters_signal={state.api.filter.list}
        filter_predicate={(filter) =>
          filter && filter.id && Object.keys(filter.query ?? {}).length > 0
        }
        current={current}
        defaults={{ sortBy: "name", sortOrder: "asc" }}
        include_my_filter
        on_change={apply_patch}
        on_manage={() => route(with_manage(), false)}
      />

      <RequestState
        signal={result_signal}
        on_success={() => {
          const tasks = result_signal.value?.data ?? [];
          if (tasks.length === 0)
            return <p class="info-box">{t("task_dashboard.search.empty")}</p>;

          return (
            <>
              <table>
                <thead>
                  <tr>
                    <th>{t("tasks.task-list.table-headings.task-name")}</th>
                    <th>{t("tasks.task-list.table-headings.assignee")}</th>
                    <th>
                      {t("tasks.task-list.table-headings.process-definition")}
                    </th>
                    <th>{t("tasks.task-list.table-headings.created-on")}</th>
                    <th>{t("tasks.task-list.table-headings.due-in")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <th scope="row">
                        <a href={`/tasks/${task.id}/form`}>
                          {task.name ?? t("dashboard.unnamed")}
                        </a>
                      </th>
                      <td>{task.assignee ?? "—"}</td>
                      <td>
                        {task.processDefinitionId ? (
                          <a href={`/processes/${task.processDefinitionId}`}>
                            {task.definitionName || task.processDefinitionId}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {task.created ? (
                          <time datetime={task.created}>
                            {formatRelativeDate(task.created)}
                          </time>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {task.due ? (
                          <time datetime={task.due}>
                            {formatRelativeDate(task.due)}
                          </time>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result_signal.value?.hasMore ? (
                <button type="button" class="load-more" onClick={load_more}>
                  {t("tasks.load-more")}
                </button>
              ) : (
                <small class="load-more-end">{t("tasks.no-more-items")}</small>
              )}
            </>
          );
        }}
      />
    </>
  );
};

export { TaskDashboardPage };
