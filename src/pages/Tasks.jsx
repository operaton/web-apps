import { useSignal } from "@preact/signals";
import { useLocation, useRoute } from "preact-iso";
import { useContext, useLayoutEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";

import engine_rest, { RequestState, RESPONSE_STATE } from "../api/engine_rest.jsx";
import * as Icons from "../assets/icons.jsx";
import { BPMNViewer } from "../components/BPMNViewer.jsx";
import { Tabs } from "../components/Tabs.jsx";
import * as formatter from "../helper/date_formatter.js";
import { AppState } from "../state.js";
import { StartProcessList } from "./StartProcessList.jsx";
import { TaskForm } from "./TaskForm.jsx";
import { formatRelativeDate } from "../helper/date_formatter.js";

const TASK_PAGE_SIZE = 3;

const filter_from_query = (query, state) => {
  if (query?.filter === "my") return { assignee: state.api.user.profile.value?.id };
  return {};
};

const TasksPage = () => {
  const state = useContext(AppState);
  const { params, query } = useRoute();

  if (state.api.task.list.value === null) {
    void engine_rest.task.get_tasks(state, "name", "asc", 0, TASK_PAGE_SIZE, filter_from_query(query, state));
  }

  if (params?.task_id === "start") {
    return (
      <main id="content" class="fade-in">
        <StartProcessList />
      </main>
    );
  }

  if (params?.task_id === "filter") {
    return (
      <main id="content" class="fade-in">
        <Filter />
      </main>
    );
  }

  return (
    <main id="content" class="tasks fade-in">
      <TaskList />
      {params?.task_id === undefined ? <NoSelectedTask /> : <Task />}
    </main>
  );
};

const TaskList = () => {
  const state = useContext(AppState),
    taskList = state.api.task.list,
    { params, query } = useRoute(),
    { route } = useLocation(),
    selectedTaskId = params.task_id,
    [t] = useTranslation(),
    activeFilter = useSignal(filter_from_query(query, state)),
    load_more = () => {
      const current = taskList.value?.data?.length ?? 0;
      engine_rest.task.get_tasks(state, "name", "asc", current, TASK_PAGE_SIZE, activeFilter.value);
    },
    change_filter = (e) => {
      const value = e.currentTarget.value;
      const filter = value === "my" ? { assignee: state.api.user.profile.value?.id } : {};
      activeFilter.value = filter;
      const url = new URL(window.location.href);
      if (value === "all") url.searchParams.delete("filter");
      else url.searchParams.set("filter", value);
      route(url.pathname + url.search, true);
      engine_rest.task.get_tasks(state, "name", "asc", 0, TASK_PAGE_SIZE, filter);
    };

  return (
    <div id="task-list">
      <h2 class="screen-hidden">{t("tasks.title")}</h2>
      <div id="task-actions">
        <label for="filter-list">{t("tasks.current-filter")}</label>
        <select id="filter-list" onChange={change_filter} value={query?.filter ?? "all"}>
          <option value="all">{t("tasks.all-tasks")}</option>
          <option value="my">{t("tasks.my-tasks")}</option>
        </select>
        <a href="/tasks/filter" className="button">{t("tasks.edit-filters")}</a>
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th>{t("tasks.task-list.table-headings.task-name")}</th>
              <th>{t("tasks.task-list.table-headings.assignee")}</th>
              <th>{t("tasks.task-list.table-headings.due-in")}</th>
            </tr>
          </thead>
          <tbody>
            <RequestState
              signal={taskList}
              on_success={() => taskList.value?.data?.map((task) => (
                  <TaskRowEntry key={task.id} task={task} selected={task.id === selectedTaskId} />))}
            />
          </tbody>
        </table>
        {taskList.value?.hasMore === true ? (
          <button class="load-more" onClick={load_more}>{t("tasks.load-more")}</button>
        ) : taskList.value?.hasMore === false ? (
          <small class="load-more-end">{t("tasks.no-more-items")}</small>
        ) : null}
      </div>
      <a href="/tasks/start" class="button start-process">{t("tasks.start-process-label")}</a>
    </div>
  );
};

const TaskRowEntry = ({ task, selected }) => {
  const { id, name, due, assignee } = task;

  useLayoutEffect(() => {
    if (selected) {
      document.getElementById(id).scrollIntoView({ behavior: "instant", block: "center" });
    }
  });

  return (
    <tr id={id} key={id} aria-selected={selected}>
      <th scope="row">
        <a href={`/tasks/${id}/${task_tabs[0].id}`} aria-labelledby={id}>
          {name}
        </a>
      </th>
      <td>{assignee ? assignee : "—"}</td>
      <td>{due ? formatRelativeDate(due) : "—"}</td>
    </tr>
  );
};

const NoSelectedTask = () => {
  const [t] = useTranslation();
  return (
    <div id="task-details" className="fade-in">
      <div class="task-empty">{t("tasks.select-task")}</div>
    </div>
  );
};

// when something has changed (e.g. assignee) in the task we have to update the task list
const Task = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    {
      api: {
        task: { one: task },
        process: {
          definition: { one: pd },
        },
      },
    } = state;

  return (
    <div id="task-details" className="fade-in">
      <section id="task-data">
        <div class="task-header">
          <div>
            <h2>{task.value?.data?.name}</h2>
            <a href={`/processes/${pd.value?.data?.id}`}>
              {pd.value?.data?.name} ({t("processes.version")} {pd.value?.data?.version})
            </a>
            {state.api.task.one.value?.data !== undefined ? (
              <p>{state.api.task.one.value?.data.description}</p>
            ) : (
              <p>{t("tasks.no-description")}</p>
            )}
          </div>
          <CommentButton />
        </div>

        <div class="task-cards">
          <SetFollowUpDateButton />
          <SetDueDateButton />
          <ClaimButton />
          <SetGroupsButton />
        </div>
      </section>
      <TaskTabs />
    </div>
  );
};

const TaskTabs = () => {
  const state = useContext(AppState);
  const { params } = useRoute();
  const [t] = useTranslation();
  const currentTaskId = useSignal(null);

  // reset error/result state (optional)
  state.task_claim_result.value = null;
  state.task_assign_result.value = null;

  if (currentTaskId.value !== params.task_id) {
    currentTaskId.value = params.task_id;
    engine_rest.task
      .get_task(state, params.task_id)
      .then(() => engine_rest.process_definition.one(state, state.api.task.one.value?.data?.processDefinitionId))
      .then(() => engine_rest.task.get_identity_links(state, state.api.task.one.value?.data?.id))
      .then(() => engine_rest.history.get_user_operation(state, state.api.task.one.value?.data?.executionId))
      .then(() => engine_rest.task.get_comments(state, state.api.task.one.value?.data?.id));
  }

  return (
    <section className="task-tabs">
      {state.api.task.one.value.data !== null && state.api.task.one.value.data !== undefined ? (
        <>
          <Tabs tabs={task_tabs} base_url={`/tasks/${state.api.task.one.value.data.id}`} className="fade-in" />
        </>
      ) : (
        t("common.loading")
      )}
    </section>
  );
};

const SetDueDateButton = () => {
  const state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation(),
    {
      api: {
        task: { one: task },
      },
    } = state,
    close = () => document.getElementById("set_due_date").close(),
    show = () => document.getElementById("set_due_date").showModal(),
    due_date = task.value?.data?.due ? new Date(Date.parse(task.value?.data?.due)) : null,
    date_state = useSignal({
      date: due_date !== null ? due_date?.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      time:
        due_date !== null
          ? due_date?.toISOString().split("T")[1].substring(0, 5)
          : new Date().toISOString().split("T")[1].substring(0, 5),
    }),
    submit = (event) => {
      event.preventDefault();
      engine_rest.task
        .update_task(state, { due: `${date_state.value.date}T${date_state.value.time}:0.000+0000` }, params.task_id)
        .then(() => {
          close();
        });
    };

  return (
    <>
      <button onClick={show} class="task-card">
        <small>{t("tasks.due-date.label")}</small>
        <span>{due_date !== null ? due_date.toLocaleString() : "—"}</span>
        <Icons.pencil />
      </button>

      <dialog id="set_due_date">
        <button onClick={close}>{t("common.close")}</button>
        <h2>{t("tasks.due-date.title")}</h2>

        <form onSubmit={submit}>
          <label for="date">{t("tasks.due-date.date")}</label>
          <input
            type="date"
            id="date"
            value={due_date !== null ? due_date?.toISOString().split("T")[0] : null}
            onInput={(e) => (date_state.value = { ...date_state.peek(), date: e.currentTarget.value })}
          />
          <label for="time">{t("tasks.due-date.time")}</label>
          <input
            type="time"
            id="time"
            value={due_date !== null ? due_date?.toISOString().split("T")[1].substring(0, 5) : null}
            onInput={(e) => (date_state.value = { ...date_state.peek(), time: e.currentTarget.value })}
          />
          <div class="button-group">
            <button type="submit">{t("common.submit")}</button>
          </div>
        </form>
      </dialog>
    </>
  );
};

const SetFollowUpDateButton = () => {
  const state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation(),
    {
      api: {
        task: { one: task },
      },
    } = state,
    close = () => document.getElementById("set_follow_up_date").close(),
    show = () => document.getElementById("set_follow_up_date").showModal(),
    followUpDate = task.value?.data?.followUp ? new Date(Date.parse(task.value?.data?.followUp)) : null,
    date_state = useSignal({
      date: followUpDate !== null ? followUpDate?.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      time:
        followUpDate !== null
          ? followUpDate?.toISOString().split("T")[1].substring(0, 5)
          : new Date().toISOString().split("T")[1].substring(0, 5),
    }),
    // due:	"2025-06-18T13:58:44.000+0000"
    submit = (event) => {
      event.preventDefault();
      engine_rest.task
        .update_task(
          state,
          { followUp: `${date_state.value.date}T${date_state.value.time}:0.000+0000` },
          params.task_id,
        )
        .then(() => {
          close();
        });
    };

  return (
    <>
      <button onClick={show} class="task-card">
        <small>{t("tasks.follow-up.label")}</small>
        <span>{followUpDate !== null ? followUpDate.toLocaleString() : "—"}</span>
        <Icons.pencil />
      </button>

      <dialog id="set_follow_up_date">
        <button onClick={close}>{t("common.close")}</button>
        <h2>{t("tasks.follow-up.title")}</h2>

        <form onSubmit={submit}>
          <label for="date">{t("tasks.due-date.date")}</label>
          <input
            type="date"
            id="date"
            value={followUpDate !== null ? followUpDate?.toISOString().split("T")[0] : null}
            onInput={(e) => (date_state.value = { ...date_state.peek(), date: e.currentTarget.value })}
          />
          <label for="time">{t("tasks.due-date.time")}</label>
          <input
            type="time"
            id="time"
            value={followUpDate !== null ? followUpDate?.toISOString().split("T")[1].substring(0, 5) : null}
            onInput={(e) => (date_state.value = { ...date_state.peek(), time: e.currentTarget.value })}
          />
          <div class="button-group">
            <button type="submit">{t("common.submit")}</button>
          </div>
        </form>
      </dialog>
    </>
  );
};

const GroupsList = () => {
  const state = useContext(AppState),
    links = state.api.task.identity_links.value?.data;
  if (!links) return "—";
  const groups = links.filter((l) => l.type === "candidate" && l.groupId).map((l) => l.groupId);
  return groups.length > 0 ? groups.join(", ") : "—";
};

const SetGroupsButton = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    {
      api: {
        task: { identity_links },
      },
    } = state,
    close = () => document.getElementById("add_groups").close(),
    show = () => document.getElementById("add_groups").showModal(),
    group_state = useSignal(null),
    submit = (event) => {
      event.preventDefault();
      engine_rest.task.add_group(state, state.api.task.one.value.data.id, group_state.value).then(() => {
        if (state.api.task.add_group.value.status === RESPONSE_STATE.SUCCESS) {
          group_state.value = "";
        }
      });
    },
    delete_group = (group_id) => engine_rest.task.delete_group(state, state.api.task.one.value.data.id, group_id);

  return (
    <>
      <button onClick={show} class="task-card">
        <small>{t("tasks.groups.set")}</small>
        <span><GroupsList /></span>
        <Icons.pencil />
      </button>

      <dialog id="add_groups">
        <header>
          <h2>{t("tasks.groups.manage")}</h2>
          <button onClick={close} class="neutral">
            <Icons.close />
          </button>
        </header>

        <h3>{t("tasks.groups.add")}</h3>
        <form onSubmit={submit}>
          <label for="group_id">{t("tasks.groups.group-id")}</label>
          <input id="group_id" key="group_id" required onInput={(e) => (group_state.value = e.currentTarget.value)} />
          <div class="button-group">
            <button type="submit">{t("tasks.groups.add-group")}</button>
          </div>
        </form>

        <h3>{t("tasks.groups.remove-groups")}</h3>

        <RequestState
          signal={state.api.task.identity_links}
          on_success={() => (
            <table>
              <thead>
                <tr>
                  <th>{t("tasks.groups.group-id")}</th>
                  <th>{t("common.action")}</th>
                </tr>
              </thead>
              <tbody>
                {state.api.task.identity_links.value.data.map(({ groupId, type }, index) =>
                  type === "candidate" ? (
                    <tr key={index}>
                      <td>{groupId}</td>
                      <td>
                        <button onClick={() => delete_group(groupId)}>{t("common.delete")}</button>
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          )}
        />
      </dialog>
    </>
  );
};

const CommentButton = () => {
  const state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation(),
    close = () => document.getElementById("add_comment").close(),
    show = () => document.getElementById("add_comment").showModal(),
    message = useSignal(""),
    submit = (event) => {
      event.preventDefault();
      engine_rest.task
        .create_comment(state, params.task_id, message.value)
        .then(() => {
          message.value = "";
          engine_rest.task.get_comments(state, params.task_id);
          close();
        });
    };

  return (
    <>
      <button onClick={show}>
        {t("tasks.comment-add")}
      </button>

      <dialog id="add_comment">
        <button onClick={close}>{t("common.close")}</button>
        <h2>{t("tasks.comment")}</h2>

        <form onSubmit={submit}>
          <label for="comment_message">{t("tasks.comment-message")}</label>
          <textarea
            id="comment_message"
            required
            value={message.value}
            onInput={(e) => (message.value = e.currentTarget.value)}
          />
          <div class="button-group">
            <button type="submit">{t("common.submit")}</button>
          </div>
        </form>
      </dialog>
    </>
  );
};

const ClaimButton = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    task = state.api.task.one.value?.data,
    user = state.api.user.profile.value?.data,
    claim_result = state.api.task.claim_result.value?.data,
    assign_result = state.api.task.assign_result.value?.data,
    unclaim_result = state.api.task.unclaim_result.value?.data,
    close = () => document.getElementById("set_assignee").close(),
    show = () => document.getElementById("set_assignee").showModal(),
    user_is_assignee = task?.assignee,
    assignee_is_different = task?.assignee && user?.id !== task?.assignee,
    claimed = claim_result?.status === RESPONSE_STATE.SUCCESS,
    assigned = assign_result?.status === RESPONSE_STATE.SUCCESS,
    unclaimed = unclaim_result?.status === RESPONSE_STATE.SUCCESS;

  return (
    <RequestState
      signal={state.api.task.one}
      on_success={() => (
        <>
          <button onClick={show} class="task-card">
            <small>{t("tasks.task-list.table-headings.assignee")}</small>
            <span>{task?.assignee ?? "—"}</span>
            <Icons.pencil />
          </button>

          <dialog id="set_assignee">
            <button onClick={close}>{t("common.close")}</button>
            {assignee_is_different && !assigned ? (
              <button onClick={() => engine_rest.task.assign_task(state, null, task.id)} className="secondary">
                <Icons.user_minus /> {t("tasks.reset-assignee")}
              </button>
            ) : (user_is_assignee || claimed) && !unclaimed ? (
              <button onClick={() => engine_rest.task.unclaim_task(state, task.id)} className="secondary">
                <Icons.user_minus /> {t("tasks.unclaim")}
              </button>
            ) : (
              <button onClick={() => engine_rest.task.claim_task(state, task.id)} className="secondary">
                <Icons.user_plus /> {t("tasks.claim")}
              </button>
            )}
          </dialog>
        </>
      )}
    />
  );
};

const Diagram = () => {
  const state = useContext(AppState),
    {
      api: {
        process: {
          definition: { diagram },
        },
        task: { one: selected_task },
      },
    } = state;

  if (selected_task !== null) {
    void engine_rest.process_definition.diagram(state, selected_task.value.data.processDefinitionId);
  }

  return (
    <>
      <div id="diagram" />
      <RequestState
        signal={diagram}
        on_success={() => (
          <BPMNViewer
            xml={diagram.value.data?.bpmn20Xml}
            container="diagram"
            highlight={[selected_task.value?.data?.taskDefinitionKey]}
          />
        )}
      />
    </>
  );
};

const Filter = () => {
  const [t] = useTranslation();

  return (
    <div class="filter-editor">
      <header>
        <h2>{t("tasks.filter.title")}</h2>
        <a href="/tasks" class="button">{t("common.back")}</a>
      </header>

      <form>
        <fieldset>
          <legend>{t("tasks.filter.general")}</legend>
          <div class="filter-fields">
            <label for="filter-name">{t("common.name")}</label>
            <input id="filter-name" />
            <label for="filter-description">{t("tasks.filter.description")}</label>
            <input id="filter-description" />
            <label for="filter-priority">{t("tasks.task-list.table-headings.priority")}</label>
            <input id="filter-priority" type="number" />
            <label for="filter-color">{t("tasks.filter.color")}</label>
            <input id="filter-color" type="color" />
            <label class="filter-checkbox" for="filter-auto-refresh">
              <input id="filter-auto-refresh" type="checkbox" />
              {t("tasks.filter.auto-refresh")}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t("tasks.filter.criteria")}</legend>
          <table>
            <thead>
              <tr>
                <th>{t("common.key")}</th>
                <th>{t("common.value")}</th>
                <th>{t("common.action")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td />
                <td><button class="small">{t("common.remove")}</button></td>
              </tr>
            </tbody>
          </table>
          <button type="button">{t("tasks.filter.add-criteria")}</button>
        </fieldset>

        <fieldset>
          <legend>{t("tasks.filter.permissions")}</legend>
          <label class="filter-checkbox">
            <input type="checkbox" />
            {t("tasks.filter.accessible-by-all")}
          </label>
          <table>
            <thead>
              <tr>
                <th>{t("tasks.filter.group-user")}</th>
                <th>{t("tasks.filter.identifier")}</th>
                <th>{t("common.action")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td />
                <td><button class="small">{t("common.remove")}</button></td>
              </tr>
            </tbody>
          </table>
          <button type="button">{t("tasks.filter.add-permission")}</button>
        </fieldset>

        <fieldset>
          <legend>{t("tasks.filter.variables")}</legend>
          <p>{t("tasks.filter.variables-hint")}</p>
          <label class="filter-checkbox">
            <input type="checkbox" />
            {t("tasks.filter.show-undefined")}
          </label>
          <table>
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("tasks.filter.label")}</th>
                <th>{t("common.action")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td />
                <td><button class="small">{t("common.remove")}</button></td>
              </tr>
            </tbody>
          </table>
          <button type="button">{t("tasks.filter.add-variable")}</button>
        </fieldset>

        <div class="filter-actions">
          <button type="submit">{t("common.save")}</button>
          <a href="/tasks">{t("common.cancel")}</a>
        </div>
      </form>
    </div>
  );
};

const merge_history = (...sources) =>
  sources
    .flatMap((s) => s())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

const history_from_operations = (signal) =>
  (signal.value?.data ?? []).map((op) => ({
    timestamp: op.timestamp,
    user: op.userId,
    type: op.operationType,
    detail: [op.property, op.newValue].filter(Boolean).join(": "),
  }));

const history_from_comments = (signal) =>
  (signal.value?.data ?? []).map((c) => ({
    timestamp: c.time,
    user: c.userId,
    type: "Comment",
    detail: c.message,
  }));

const HistoryTab = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    {
      api: {
        history: { user_operation },
        task: { one, comment },
      },
    } = state;

  const ready =
    user_operation.value?.status === RESPONSE_STATE.SUCCESS &&
    comment.list.value?.status === RESPONSE_STATE.SUCCESS;

  const entries = ready
    ? merge_history(
        () => history_from_operations(user_operation),
        () => history_from_comments(comment.list),
      )
    : [];

  return (
    <>
      <h2>{t("tasks.history.title")}</h2>

      <table>
        <thead>
          <tr>
            <th>{t("tasks.history.date-time")}</th>
            <th>{t("tasks.history.user")}</th>
            <th>{t("common.type")}</th>
            <th>{t("tasks.history.detail")}</th>
          </tr>
        </thead>
        <tbody>
          {ready ? (
            entries.map((entry, i) => (
              <tr key={i}>
                <td>{formatRelativeDate(entry.timestamp)}</td>
                <td>{entry.user}</td>
                <td>{entry.type}</td>
                <td>{entry.detail}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colspan="4">{t("common.loading")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
};

const task_tabs = [
  {
    nameKey: "tasks.tabs.form",
    id: "form",
    pos: 0,
    target: <TaskForm />,
  },
  {
    nameKey: "tasks.tabs.history",
    id: "history",
    pos: 1,
    target: <HistoryTab />,
  },
  {
    nameKey: "tasks.tabs.diagram",
    id: "diagram",
    pos: 2,
    target: <Diagram />,
  },
];

export { TasksPage };
