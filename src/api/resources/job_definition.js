import { GET, PUT } from '../helper.jsx'

const get_job_definitions = (state, definition_id) =>
  GET(`/job-definition?processDefinitionId=${definition_id}`, state, state.api.job_definition.all.by_process_definition)

const set_retries = (state, id, retries, due_date = null) =>
  PUT(
    `/job-definition/${id}/retries`,
    { retries, ...(due_date ? { dueDate: due_date } : {}) },
    state,
    state.api.job_definition.retries
  )

const job_definition = {
  all: {
    by_process_definition: get_job_definitions
  },
  set_retries
}

export default job_definition
