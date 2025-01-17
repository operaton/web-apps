/**
 * api.js
 *
 * Provides endpoints to the default Operaton REST API.
 *
 * Please refer to the `docs/Coding Conventions.md` "JavaScript > api.js" to
 * learn how we organize the code in this file.
 */

const _url = (state) => `${state.server.value}/engine-rest`

let headers = new Headers()
headers.set('Authorization', 'Basic ' + window.btoa(unescape(encodeURIComponent('demo:demo')))) //TODO authentication
let headers_json = headers
headers_json.set('Content-Type', 'application/json')

export const get_user_profile = (state, user_name) => {
  // TODO remove it when we have a login!
  if (!user_name) {
    user_name = 'demo'
  }

  fetch(`${_url(state)}/user/${user_name}/profile`, { headers })
    .then(response => response.json())
    .then(json => state.user_profile.value = json)
}

export const get_users = (state) =>
  fetch(`${_url(state)}/user`)
    .then(response => response.json())
    .then(json => state.users.value = json)

export const create_user = (state) =>
  fetch(`${_url(state)}/user/create`,
    {
      headers: headers_json,
      method: 'POST',
      body: JSON.stringify(state.user_create.value)
    })
    .then(response => response.ok ? response.ok : Promise.reject(response))
    .then(result => state.user_create_response.value = {success: true, ...result})
    .catch(response => response.json())
    .then(json => state.user_create_response.value = { success: false, ...json })


export const get_user_count = (state) =>
  fetch(`${_url(state)}/user`)
    .then(response => response.json())
    .then(json => state.user_count.value = json)


export const get_process_definitions = (state) =>
  fetch(`${_url(state)}/process-definition/statistics`)
    .then(response => response.json())
    .then(json => state.process_definitions.value = json)

export const get_process_definition = (state, id) =>
  fetch(`${_url(state)}/process-definition/${id}`)
    .then(response => response.json())
    .then(json => state.process_definition.value = json)

const url_params = (definition_id) =>
  new URLSearchParams({
    unfinished: true,
    sortBy: 'startTime',
    sortOrder: 'asc',
    processDefinitionId: definition_id,
  }).toString()

export const get_process_instances = (state, definition_id) =>
  fetch(`${_url(state)}/history/process-instance?${url_params(definition_id)}`)
    .then(response => response.json())
    .then(json => (state.process_instances.value = json))

export const get_process_incidents = (state, definition_id) =>
  fetch(`${_url(state)}/history/incident?processDefinitionId=${definition_id}`)
    .then(response => response.json())
    .then(json => (state.process_incidents.value = json))

export const get_process_instance = (state, instance_id) =>
  fetch(`${_url(state)}/process-instance/${instance_id}`)
    .then(response => response.json())
    .then(json => state.process_instance.value = json)

export const get_process_instance_variables = (state, instance_id) =>
  fetch(`${_url(state)}/process-instance/${instance_id}/variables`)
    .then(response => response.json())
    .then(json => state.selection_values.value = json)

export const get_process_instance_incidents = (state, instance_id) =>
  fetch(`${_url(state)}/history/incident?processInstanceId=${instance_id}`)
    .then(response => response.json())
    .then(json => (state.process_instance_incidents.value = json))

export const get_process_instance_tasks = (state, instance_id) =>
  fetch(`${_url(state)}/task?processInstanceId=${instance_id}`)
    .then(response => response.json())
    .then(json => (state.process_instance_tasks.value = json))

export const get_called_process_instances = (state, instance_id) =>
  fetch(`${_url(state)}/process-instance?superProcessInstance=${instance_id}`)
    .then(response => response.json())
    .then(json => (state.called_process_instances.value = json))

export const get_called_process_definitions = (state, definition_id) =>
  fetch(`${_url(state)}/process-definition/${definition_id}/static-called-process-definitions`)
    .then(response => response.json())
    .then(json => state.called_definitions.value = json)

export const get_job_definitions = (state, definition_id) =>
  fetch(`${_url(state)}/job-definition?processDefinitionId=${definition_id}`)
    .then(response => response.json())
    .then(json => state.job_definitions.value = json)

export const get_diagram = (state, definition_id) =>
  fetch(`${_url(state)}/process-definition/${definition_id}/xml`)
    .then(response => response.json())
    .then(json => state.process_definition_diagram.value = json)

// getting all tasks, when no sorting is provided it will use "name" and ascending
export const get_tasks = (state, sort_key, sort_order) => {
  const sort = sort_key ? sort_key : 'name'
  const order = sort_order ? sort_order : 'asc'

  fetch(`${_url(state)}/task?sortBy=${sort}&sortOrder=${order}`, { headers: headers })
    .then((response) => response.json())
    .then(json => {
      const ids = json.map(task => task.processDefinitionId) // list of needed process definitions

      // we need the process definition name for each task
      get_task_process_definitions(state, ids)
        .then( defList => {
          const defMap = new Map() // helper map, mapping ID to process name
          defList.map(def => defMap.set(def.id, def))

          // set process name to task list
          json.forEach((task) => {
            const def = defMap.get(task.processDefinitionId)
            task.def_name = def ? def.name : ''
            task.def_version = def ? def.version : ''
          })

          state.tasks.value = json
        })
    })
}

// API call to enhance the data of the task list, no need for signal here
const get_task_process_definitions = (state, ids) =>
  fetch(`${_url(state)}/process-definition?processDefinitionIdIn=${ids}`, { headers: headers })
    .then((response) => response.json())

export const get_task = (state, task_id) =>
   fetch(`${_url(state)}/task/${task_id}`, { headers: headers })
     .then((response) => response.json())
     .then(json => state.task.value = json)

export const get_task_rendered_form = (state, task_id) =>
   fetch(`${_url(state)}/task/${task_id}/rendered-form`, { headers: headers })
     .then((response) => response.text())
     .then(text => state.task_generated_form.value = text)

export const get_task_deployed_form = (state, task_id) =>
  fetch(`${_url(state)}/task/${task_id}/deployed-form`, { headers: headers })
    .then((response) => response.json())
    .then(json => state.task_deployed_form.value = json)

// claim and unclaim tasks
export const post_task_claim = (state, do_claim, task_id) =>
  fetch(`${_url(state)}/task/${task_id}/${do_claim ? 'claim' : 'unclaim'}`,
    {
      headers: headers_json,
      method: 'POST',
      body: JSON.stringify({ userId: state.user_profile.value.id })
    })
    .then((response) => response.ok)
    .then(() => get_task(state, task_id))

export const post_task_assign = (state, assignee, task_id) =>
  fetch(`${_url(state)}/task/${task_id}/assignee`,
    {
      headers: headers_json ,
      method: 'POST',
      body: JSON.stringify({ userId: assignee })
    })
    .then((response) => response.ok)
    .then(() => get_task(state, task_id))


/* return null or error message from server, in fact all validation should be done by HTML5 validation, but who knows ... */
export const post_task_form = (state, task_id, data) => {
  fetch(`${_url(state)}/task/${task_id}/submit-form`,
    {
      headers: headers_json ,
      method: 'POST',
      body: JSON.stringify({ variables: data, withVariablesInReturn: true })
    })
    .then((response) => response.json())
    .then(json => {
      // if there is a json type, we get an error message back
      if (!json.type) {
        state.tasks.value = null
        // it's important that the form data is cleared before the task data, because the signal effect will be called immediately
        state.task_generated_form.value = null
        state.selected_task.value = null // the task is completed, so let it go
      } else {
        return json.message
      }
    })

  return null
}