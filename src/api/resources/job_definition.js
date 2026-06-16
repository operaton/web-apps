import { GET, PUT } from '../helper.jsx'

const get_job_definitions = (state, definition_id) =>
  GET(`/job-definition?processDefinitionId=${definition_id}`, state, state.api.job_definition.all.by_process_definition)

const set_job_definition_suspended = (state, id, suspended, includeJobs = false) =>
  PUT(
    `/job-definition/${id}/suspended`,
    { suspended, includeJobs },
    state,
    state.api.job_definition.update,
  )

const job_definition = {
  all: {
    by_process_definition: get_job_definitions
  },
  set_suspended: set_job_definition_suspended,
}

export default job_definition
