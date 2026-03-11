import { useSignal } from "@preact/signals";
import { useRoute } from "preact-iso";
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

const TasksPage = () => {
  const state = useContext(AppState);
  const { params } = useRoute();

  if (state.api.task.list.value === null) {
    void engine_rest.task.get_tasks(state);
  }

  return (
    <main id="content" class="tasks fade-in">
      <TaskList />
      {{
        start: <StartProcessList />,
        filter: <Filter />,
        undefined: <NoSelectedTask />,
      }[params?.task_id] ?? <Task />}
    </main>
  );
};

const TaskList = () => {
  const state = useContext(AppState),
    taskList = state.api.task.list,
    { params } = useRoute(),
    selectedTaskId = params.task_id,
    [t] = useTranslation();

  return (
    <div id="task-list">
      <h2 class="screen-hidden">{t("tasks.title")}</h2>
      <div id="task-actions">
        <a href="/tasks/start" className="button">{t("tasks.start-process-label")}</a>

        <label>{t("tasks.current-filter")}</label>
        <select id="filter-list">
          <option selected>{t("tasks.all-tasks")}</option>
          <option>{t("tasks.my-tasks")}</option>
        </select>
        <a href="/tasks/filter" className="button">{t("tasks.edit-filters")}</a>
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th>{t("tasks.task-list.table-headings.task-name")}</th>
              <th>{t("tasks.task-list.table-headings.process-definition")}</th>
              <th>{t("tasks.task-list.table-headings.process-version")}</th>
              <th>{t("tasks.task-list.table-headings.created-on")}</th>
              <th>{t("tasks.task-list.table-headings.assignee")}</th>
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
        <small>{t("tasks.load-more")}</small>
      </div>
    </div>
  );
};

const TaskRowEntry = ({ task, selected }) => {
  const { id, name, created, assignee, priority, definitionName, definitionVersion } = task;

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
      <td>{definitionName}</td>
      <td>{definitionVersion}</td>
      <td>{formatter.formatRelativeDate(created)}</td>
      <td>{assignee ? assignee : "-"}</td>
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

        <dl>
          <dt>{t("tasks.follow-up.label")}</dt>
          <dd>
            <SetFollowUpDateButton />
          </dd>
          <dt>{t("tasks.due-date.set")}</dt>
          <dd>
            <SetDueDateButton />
          </dd>
          <dt>{t("tasks.task-list.table-headings.assignee")}</dt>
          <dd>
            <ClaimButton />
          </dd>
          <dt>{t("tasks.groups.set")}</dt>
          <dd>
            <SetGroupsButton />
          </dd>
        </dl>

        <button>
          <Icons.chat_bubble_left /> {t("tasks.comment")}
        </button>
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
      .then(() => engine_rest.task.get_identity_links(state, state.api.task.one.value?.data?.id));
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
      <button onClick={show} class="link">
        {due_date === null ? t("tasks.due-date.set") : due_date.toLocaleString()}
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
      <button onClick={show} class="link">
        {followUpDate === null ? t("tasks.follow-up.set") : followUpDate.toLocaleString()}
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
      <button onClick={show} class="link">
        {identity_links.value?.data
          ? t("tasks.groups.set")
          : identity_links.value?.data
              ?.reduce((res, { groupId, type }) => (type === "candidate" ? `${res + groupId}, ` : res), "")
              .slice(0, -2)}
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
          <button class="link" onClick={show}>
            {task?.assignee === null ? t("tasks.claim") : task?.assignee === user?.id ? t("tasks.you") : task?.assignee}
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
        on_success={() => <BPMNViewer xml={diagram.value.data?.bpmn20Xml} container="diagram" />}
      />
    </>
  );
};

const Filter = () => {
  const [t] = useTranslation();

  return (
    <div>
      <form>
        <h2>{t("tasks.filter.title")}</h2>
        <h3>{t("tasks.filter.general")}</h3>
        <label>
          {t("common.name")}
          <input />
        </label>
        <label>
          {t("tasks.filter.description")}
          <input />
        </label>
        <label>
          {t("tasks.filter.color")}
          <input type="color" />
        </label>
        <label>
          {t("tasks.task-list.table-headings.priority")}
          <input type="number" />
        </label>
        <label>
          {t("tasks.filter.auto-refresh")}
          <input type="checkbox" />
        </label>

        <h3>{t("tasks.filter.criteria")}</h3>
        <button>{t("tasks.filter.add-criteria")}</button>
        <table>
          <thead>
            <tr>
              <th scope="column">{t("common.key")}</th>
              <th scope="column">{t("common.value")}</th>
              <th scope="column">{t("common.action")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td>{t("common.remove")}</td>
            </tr>
          </tbody>
        </table>

        <h3>{t("tasks.filter.permissions")}</h3>

        <label>
          {t("tasks.filter.accessible-by-all")}
          <input type="checkbox" />
        </label>

        <button>{t("tasks.filter.add-permission")}</button>
        <table>
          <thead>
            <tr>
              <th scope="column">{t("tasks.filter.group-user")}</th>
              <th scope="column">{t("tasks.filter.identifier")}</th>
              <th scope="column">{t("common.action")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td>{t("common.remove")}</td>
            </tr>
          </tbody>
        </table>

        <h3>{t("tasks.filter.variables")}</h3>

        <p>{t("tasks.filter.variables-hint")}</p>

        <label>
          {t("tasks.filter.show-undefined")}
          <input type="checkbox" />
        </label>

        <button>{t("tasks.filter.add-variable")}</button>
        <table>
          <thead>
            <tr>
              <th scope="column">{t("common.name")}</th>
              <th scope="column">{t("tasks.filter.label")}</th>
              <th scope="column">{t("common.action")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td>{t("common.remove")}</td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
};

const HistoryTab = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    {
      api: {
        history: { user_operation },
        task: { one },
      },
    } = state;

  void engine_rest.history.get_user_operation(state, one.value?.data?.executionId);

  return (
    <>
      <h2>{t("tasks.history.title")}</h2>

      <table>
        <thead>
          <tr>
            <th>{t("tasks.history.date-time")}</th>
            <th>{t("tasks.history.user")}</th>
            <th>{t("common.action")}</th>
            <th>{t("common.type")}</th>
            <th>{t("common.value")}</th>
          </tr>
        </thead>
        <tbody>
          <RequestState signal={user_operation} on_success={() => <HistoryEntry />} />
        </tbody>
      </table>
    </>
  );
};

const HistoryEntry = () =>
  useContext(AppState).api.history.user_operation.value.data.map(
    ({ timestamp, userId, operationType, property, newValue }, index) => (
      <tr key={index}>
        <td>{formatRelativeDate(timestamp)}</td>
        <td>{userId}</td>
        <td>{operationType}</td>
        <td>{property}</td>
        <td>{newValue}</td>
      </tr>
    ),
  );

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
