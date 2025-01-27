/**
 * api.js
 *
 * Provides endpoints to the default Operaton REST API.
 *
 * Please refer to the `docs/Coding Conventions.md` "JavaScript > api.js" to
 * learn how we organize the code in this file.
 */

const _url = (state) => `${state.server.value.url}/engine-rest`;

let headers = new Headers();
headers.set('Authorization', `Basic ${window.btoa(unescape(encodeURIComponent('demo:demo')))}`); // TODO authentication
let headers_json = headers;
headers_json.set('Content-Type', 'application/json');

const get = (url, state, signal) =>
  fetch(`${_url(state)}${url}`)
    .then((response) => response.json())
    .then((json) => (signal.value = json));

const post = (url, body, state, signal) =>
  fetch(`${_url(state)}${url}`, {
    headers: headers_json,
    method: 'POST',
    body: JSON.stringify(body),
  })
    .then((response) =>
      response.ok ? response.json() : Promise.reject(response)
    )
    .then((result) => (signal.value = { success: true, ...result }))
    .catch((response) => response.json())
    .then((json) => (signal.value = { success: false, ...json }));

export const get_user_profile = (state, user_name) =>
  get(`/user/${user_name ?? 'demo'}/profile`, state, state.user_profile); // TODO remove `?? 'demo'` when we have working authentication
export const get_users = (state) => get('/user', state, state.users);
export const create_user = (state) =>
  post('/user/create', state.user_create.value, state, state.user_create_response);
export const get_user_count = (state) => get('/user', state, state.user_count);
export const get_user_groups = (state, user_name) =>
  post(
    '/group',
    { member: user_name, firstResult: 0, maxResults: 50 },
    state,
    state.user_groups
  );
export const get_process_definitions = (state) =>
  get('/process-definition/statistics', state, state.process_definitions);
export const get_process_definition = (state, id) =>
  get(`/process-definition/${id}`, state, state.process_definition);
export const get_process_instances = (state, definition_id) =>
  get(
    `/history/process-instance?${url_params(definition_id)}`,
    state,
    state.process_instances
  );
export const get_process_incidents = (state, definition_id) =>
  get(
    `/history/incident?processDefinitionId=${definition_id}`,
    state,
    state.process_incidents
  );
export const get_task = (state, task_id) =>
  get(`/task/${task_id}`, state, state.task);

export const create_task = (state, taskData, signal) =>
  post('/task/create', taskData, state, signal); // New function for task creation

export const get_tasks = (state, sort_key = 'name', sort_order = 'asc') =>
  fetch(
    `${_url(state)}/task?sortBy=${sort_key}&sortOrder=${sort_order}`,
    { headers }
  )
    .then((response) => response.json())
    .then((json) => {
      const definition_ids = [
        ...new Set(json.map((task) => task.processDefinitionId)),
      ];

      // we need the process definition name for each task
      get_task_process_definitions(state, definition_ids).then((defList) => {
        const defMap = new Map(); // helper map, mapping ID to process name
        defList.map((def) => defMap.set(def.id, def));

        // set process name to task list
        json.forEach((task) => {
          const def = defMap.get(task.processDefinitionId);
          task.def_name = def ? def.name : '';
          task.def_version = def ? def.version : '';
        });

        state.tasks.value = json;
      });
    });

// API call to enhance the data of the task list, no need for signal here
const get_task_process_definitions = (state, ids) =>
  fetch(`${_url(state)}/process-definition?processDefinitionIdIn=${ids}`, {
    headers,
  }).then((response) => response.json());

const url_params = (definition_id) =>
  new URLSearchParams({
    unfinished: true,
    sortBy: 'startTime',
    sortOrder: 'asc',
    processDefinitionId: definition_id,
  }).toString();
