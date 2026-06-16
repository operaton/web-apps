import { GET, PUT } from "../helper.jsx";

const get_job_definitions = (state, definition_id) =>
  GET(
    `/job-definition?processDefinitionId=${definition_id}`,
    state,
    state.api.job_definition.all.by_process_definition,
  );

const set_priority = (state, id, priority, include_jobs = false) =>
  PUT(
    `/job-definition/${id}/jobPriority`,
    { priority, includeJobs: priority !== null && include_jobs },
    state,
    state.api.job_definition.priority,
  );

const job_definition = {
  all: {
    by_process_definition: get_job_definitions,
  },
  set_priority,
};

export default job_definition;
