import { useContext, useState } from 'preact/hooks';
import * as api from '../../api';
import * as formatter from '../../helper/date_formatter.js';
import { Task, task_tabs } from './Task.jsx';
import * as Icons from '../../assets/icons.jsx';
import { AppState } from '../../state.js';
import { useRoute, useLocation } from 'preact-iso';
import { useSignalEffect } from '@preact/signals';

const TasksPage = () => {
  const state = useContext(AppState);
  const { params } = useRoute();
  const location = useLocation();
  const server = state.server.value.url;

  useSignalEffect(() => {
    if (state.server.value.url !== server && location.path !== '/tasks') {
      location.route('/tasks', true);
    }
  });

  if (!state.user_profile.value) {
    void api.get_user_profile(state, null);
  }
  void api.get_tasks(state);

  if (params.task_id) {
    void api.get_task(state, params.task_id);
  } else {
    state.task.value = null;
  }

  return (
    <main id="tasks" class="fade-in">
      <TaskList />
      {params?.task_id ? <Task /> : <NoSelectedTask />}
    </main>
  );
};

const NoSelectedTask = () => {
  const [showModal, setShowModal] = useState(false);
  const state = useContext(AppState);

  const handleCreateTask = async (taskData) => {
    try {
      const response = await api.create_task(state, taskData, state.task_create_response);
      if (response.success) {
        // Reload tasks after successful creation
        void api.get_tasks(state);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  return (
    <div id="task-details" className="fade-in">
      <div class="task-empty">
        <div class="info-box">
          Please select a task from the task list on the left side.
        </div>
        <div className="button-box">
          {/* <button
            className="task-button"
            onClick={() => setShowModal(true)}>
            Create a Task
          </button> */}

<button
            className="task-button"
            >
            Start Process
          </button>
        </div>
        {showModal && <TaskCreateModal onCreateTask={handleCreateTask} onClose={() => setShowModal(false)} />}
      </div>
    </div>
  );
};

const TaskCreateModal = ({ onCreateTask, onClose }) => {
  const [taskData, setTaskData] = useState({
    name: '',
    description: '',
    priority: '50',
    assignee: 'userId',
    tenantId: null,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTaskData({ ...taskData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateTask(taskData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Create a New Task</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Task Name:
              <input
                type="text"
                name="name"
                value={taskData.name}
                onChange={handleChange}
                placeholder="Enter task name"
                required
              />
            </label>
            <label>
              Priority:
              <input
                type="number"
                name="priority"
                value={taskData.priority}
                onChange={handleChange}
                placeholder="50"
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Description:
              <textarea
                name="description"
                value={taskData.description}
                onChange={handleChange}
                placeholder="Enter task description"
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Assignee:
              <input
                type="text"
                name="assignee"
                value={taskData.assignee}
                onChange={handleChange}
                placeholder="Enter assignee"
              />
            </label>
          </div>
          <div className="modal-buttons">
            <button type="submit" className="submit-button">
              Create Task
            </button>
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TaskList = () => {
  const { tasks } = useContext(AppState);

  return (
    <nav id="task-list" aria-label="tasks">
      <div class="tile-filter" id="task-filter">
        <div class="filter-header" onClick={open_filter}>
          <span class="label">Filter Tasks & Search</span>
          <span class="icon down">
            <Icons.chevron_down />
          </span>
          <span class="icon up">
            <Icons.chevron_up />
          </span>
        </div>
        <div class="filter-menu">
          <menu>
            <li>My Tasks</li>
            <li>Claimed Tasks</li>
          </menu>
        </div>
      </div>

      <ul class="tile-list">
        {tasks.value?.map((task) => (
          <TaskTile key={task.id} {...task} />
        ))}
      </ul>
    </nav>
  );
};

const open_filter = () => {
  const menu = document.getElementById('task-filter');
  menu.classList.toggle('open');
};

const TaskTile = ({ id, name, created, assignee, priority, def_name }) => {
  const state = useContext(AppState);
  const selected = state.task.value?.id === id;

  return (
    <li key={id} class={selected ? 'selected' : ''}>
      <a href={`/tasks/${id}/${task_tabs[0].id}`} data-task-id={id} aria-labelledby={id}>
        <header>
          <span>{def_name}</span>
          <span>{formatter.formatRelativeDate(created)}</span>
        </header>
        <div id={id} class="title">{name}</div>
        <footer>
          <span>
            Assigned to{' '}
            <em>
              {assignee
                ? state.user_profile.value &&
                  state.user_profile.value.id === assignee
                  ? 'me'
                  : assignee
                : 'no one'}
            </em>
          </span>
          <span class="tile-right">Priority {priority}</span>
        </footer>
      </a>
    </li>
  );
};

export { TasksPage };
