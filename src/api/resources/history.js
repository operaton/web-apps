import { GET, PAGINATED_GET } from '../helper.jsx'

const INSTANCE_PAGE_SIZE = 20
const DECISION_INSTANCE_PAGE_SIZE = 20

const instance_url = (definition_id, params = {}, { unfinished = false } = {}) => {
  const merged = {
    sortBy: 'startTime',
    sortOrder: 'asc',
    ...(unfinished ? { unfinished: true } : {}),
    processDefinitionId: definition_id,
    ...params,
  }
  return new URLSearchParams(merged).toString()
}

const get_process_instances = (state, definition_id, params = {}, firstResult = 0) =>
  PAGINATED_GET(
    `/history/process-instance?${instance_url(definition_id, params)}`,
    state,
    state.api.process.instance.list,
    firstResult,
    INSTANCE_PAGE_SIZE,
  )

const get_process_instances_unfinished = (state, definition_id, params = {}, firstResult = 0) =>
  PAGINATED_GET(
    `/history/process-instance?${instance_url(definition_id, params, { unfinished: true })}`,
    state,
    state.api.process.instance.list,
    firstResult,
    INSTANCE_PAGE_SIZE,
  )

const get_process_instance = (state, definition_id) =>
  GET(`/history/process-instance/${definition_id}`, state, state.api.process.instance.one)

const get_incidents_by_process_definition = (state, definition_id) =>
  GET(`/history/incident?processDefinitionId=${definition_id}`, state, state.api.history.incident.by_process_definition)

const get_incidents_by_process_instance = (state, instance_id) =>
  GET(`/history/incident?processInstanceId=${instance_id}`, state, state.api.history.incident.by_process_instance)

const get_process_instance_variable = (state, instance_id) =>
  GET(`/history/variable-instance?processInstanceId=${instance_id}`, state, state.api.process.instance.variables)

const get_historic_tasks_by_instance = (state, instance_id) =>
  GET(`/history/task?processInstanceId=${instance_id}`, state, state.api.history.task.by_process_instance)

const get_historic_called_instances = (state, instance_id) =>
  GET(`/history/process-instance?superProcessInstanceId=${instance_id}`, state, state.api.history.process_instance.called)

const get_decision_instances_by_definition = (state, definition_id, firstResult = 0) =>
  PAGINATED_GET(
    `/history/decision-instance?${new URLSearchParams({
      decisionDefinitionId: definition_id,
      sortBy: 'evaluationTime',
      sortOrder: 'desc',
    }).toString()}`,
    state,
    state.api.history.decision_instance.list,
    firstResult,
    DECISION_INSTANCE_PAGE_SIZE,
  )

/**
 * Task History
 */
const get_user_operation = (state, execution_id) =>
  GET(`/history/user-operation?processInstanceId=${execution_id}`, state, state.api.history.user_operation)

const history = {
  process_instance: {
    all: get_process_instances,
    one: get_process_instance,
    all_unfinished: get_process_instances_unfinished,
    called: get_historic_called_instances,
  },
  incident: {
    by_process_definition: get_incidents_by_process_definition,
    by_process_instance: get_incidents_by_process_instance
  },
  variable_instance: {
    by_process_instance: get_process_instance_variable,
  },
  task: {
    by_process_instance: get_historic_tasks_by_instance,
  },
  decision_instance: {
    by_decision_definition: get_decision_instances_by_definition,
  },
  get_user_operation
}

export default history
