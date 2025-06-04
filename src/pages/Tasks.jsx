import { useContext } from 'preact/hooks'
import { AppState } from '../state.js'
import { useRoute } from 'preact-iso'
import * as formatter from '../helper/date_formatter.js'
import * as Icons from '../assets/icons.jsx'
import { Tabs } from '../components/Tabs.jsx'
import { TaskForm } from './TaskForm.jsx'
import engine_rest, { RequestState } from '../api/engine_rest.jsx'
import { useSignal } from '@preact/signals'
import { BpmnViewer } from '../components/Bpmn-Viewer.jsx'

const TasksPage = () => {
  const state = useContext(AppState)
  const { params } = useRoute()

  if (state.api.task.list.value === null) {
    void engine_rest.task.get_tasks(state)

    //TODO: remove, only for dev
    console.warn(state)
  }

  return (
    <main id="tasks" class="fade-in">
      <TaskList />
      {params?.task_id ? <Task /> : <NoSelectedTask />}
    </main>
  )
}

const TaskList = () => {
  const state = useContext(AppState)
  const taskList = state.api.task.list
  const { params } = useRoute()
  const selectedTaskId = params.task_id

  return (
    <nav id="task-list" aria-label="tasks">
      <div class="tile-filter" id="task-filter">
        <div class="filter-header" onClick={open_filter}>
          <span class="label">Filter Tasks & Search</span>
          <span class="icon down"><Icons.chevron_down /></span>
          <span class="icon up"><Icons.chevron_up /></span>
        </div>
        <div class="filter-menu">
          <menu>
            <li>My Tasks</li>
            <li>Claimed Tasks</li>
          </menu>
        </div>
      </div>

      <ul class="list">
        <RequestState
          signl={taskList}
          on_success={() =>
            taskList.value?.data?.map(task =>
              <TaskTile key={task.id} task={task}
                        selected={task.id === selectedTaskId} />)} />
      </ul>
    </nav>
  )
}

const open_filter = () => {
  const menu = document.getElementById('task-filter')
  menu.classList.toggle('open')
}

const TaskTile = ({ task, selected }) => {
  const { id, name, created, assignee, priority, definitionName } = task

  return (
    <li key={id} class={selected ? 'selected' : ''}>
      <a href={`/tasks/${id}/${task_tabs[0].id}`} aria-labelledby={id}>
        <header>
          <span>{definitionName}</span>
          <span>{formatter.formatRelativeDate(created)}</span>
        </header>
        <div id={id} class="title">{name}</div>
        <footer>
          <span>
            Assigned to <em>{assignee ? assignee : 'no one'}</em>
          </span>
          <span class="tile-right">Priority {priority}</span>
        </footer>
      </a>
    </li>
  )
}

const NoSelectedTask = () => (
  <div id="task-details" className="fade-in">
    <div class="task-empty">
      <div class="info-box">
        Please select a task from the task list on the left side.
      </div>
    </div>
  </div>
)

// when something has changed (e.g. assignee) in the task we have to update the task list
const Task = () =>
  <div id="task-details" className="fade-in">
    <menu class="action-bar">
      <li><ResetAssigneeBtn /></li>
      <li>
        <button><Icons.users /> Set Group</button>
      </li>
      <li>
        <button><Icons.calendar /> Set Follow Up Date</button>
      </li>
      <li>
        <button><Icons.bell /> Set Due Date</button>
      </li>
      <li>
        <button><Icons.chat_bubble_left /> Comment</button>
      </li>
      <li>
        <a href="/tasks/start" class="button" >
          <Icons.play />
          Start Process</a>
      </li>
    </menu>
    <TaskDetails />
  </div>

const TaskDetails = () => {
  const state = useContext(AppState)
  const { params } = useRoute()
  const currentTaskId = useSignal(null)

  // reset error/result state (optional)
  state.task_claim_result.value = null
  state.task_assign_result.value = null

  if (currentTaskId.value !== params.task_id) {
    currentTaskId.value = params.task_id
    engine_rest.task.get_task(state, params.task_id)
      .then(() => engine_rest.process_definition.one(state, state.api.task.one.value?.data?.processDefinitionId))
  }

  return (
    <section className="task-container">
      {state.api.task.one.value?.data?.name} [Process version: v{state.api.process.definition.one.value?.data?.version} | <a href="">Show process</a>]
      <h3>{state.api.task.one?.name}</h3>
      {state.api.task.one?.description ? <p>{state.api.task.one.description}</p> : <p>No description provided.</p>}

      {state.api.task.one.value !== null && state.api.task.one.value.data !== undefined
        ? <Tabs
          tabs={task_tabs}
          base_url={`/tasks/${state.api.task.one.value.data.id}`}
          className="fade-in"
        />
        : 'Loading'
      }
    </section>
  )
}

const ResetAssigneeBtn = () => {
  const state = useContext(AppState)
  const task = state.api.task.value
  const user = state.user_profile.value

  const user_is_assignee = task?.assignee
  const assignee_is_different = task?.assignee && user?.id !== task?.assignee
  const claimed = state.task_claim_result.value?.success
  const assigned = state.task_assign_result.value?.success

  return assignee_is_different && !assigned ? (
    <button onClick={() => engine_rest.task.assign_task(state, null, task.id)} className="secondary">
      <Icons.user_minus /> Reset Assignee
    </button>
  ) : user_is_assignee || claimed ? (
    <button onClick={() => engine_rest.task.unclaim_task(state, task.id)} className="secondary">
      <Icons.user_minus /> Unclaim
    </button>
  ) : (
    <button onClick={() => engine_rest.task.claim_task(state, task.id)} className="secondary">
      <Icons.user_plus /> Claim
    </button>
  )
}

const Diagram = () => {
  const
    state = useContext(AppState),
    { api: { process: { definition: { diagram } }, task: { one: selected_task } } } = state

  if (selected_task !== null) {
    void engine_rest.process_definition.diagram(state, selected_task.value.data.processDefinitionId)
  }

  return <>
    <div id="diagram" />
    <RequestState
      signl={diagram}
      on_success={() =>
        <BpmnViewer xml={diagram.value.data?.bpmn20Xml} container="diagram" />}
    />
  </>
}

const task_tabs = [
  {
    name: 'Form',
    id: 'form',
    pos: 0,
    target: <TaskForm />
  },
  {
    name: 'History',
    id: 'history',
    pos: 1,
    target: <p>History</p>
  },
  {
    name: 'Diagram',
    id: 'diagram',
    pos: 2,
    target: <Diagram />
  }
]

export { TasksPage }
