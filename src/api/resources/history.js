import { GET, PAGINATED_GET, PUT } from '../helper.jsx'

const INSTANCE_PAGE_SIZE = 20
const OPERATION_LOG_PAGE_SIZE = 30

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

/**
 * Task History
 */
const get_user_operation = (state, execution_id) =>
  GET(`/history/user-operation?processInstanceId=${execution_id}`, state, state.api.history.user_operation)

const operation_log_url = (params = {}) => {
  const merged = {
    sortBy: 'timestamp',
    sortOrder: 'desc',
    ...params,
  }
  return new URLSearchParams(merged).toString()
}

const get_operation_log = (state, params = {}, firstResult = 0) =>
  PAGINATED_GET(
    `/history/user-operation?${operation_log_url(params)}`,
    state,
    state.api.history.operation_log.list,
    firstResult,
    OPERATION_LOG_PAGE_SIZE,
  )

const get_operation_log_count = (state, params = {}) =>
  GET(`/history/user-operation/count?${operation_log_url(params)}`, state, state.api.history.operation_log.count)

const set_operation_log_annotation = (state, operation_id, annotation) =>
  PUT(
    `/history/user-operation/${operation_id}/set-annotation`,
    { annotation },
    state,
    state.api.history.operation_log.update,
  )

const clear_operation_log_annotation = (state, operation_id) =>
  PUT(
    `/history/user-operation/${operation_id}/clear-annotation`,
    {},
    state,
    state.api.history.operation_log.update,
  )

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
  operation_log: {
    all: get_operation_log,
    count: get_operation_log_count,
    set_annotation: set_operation_log_annotation,
    clear_annotation: clear_operation_log_annotation,
  },
  get_user_operation
}

export default history
