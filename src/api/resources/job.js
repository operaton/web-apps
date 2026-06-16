import { GET } from "../helper.jsx";

const get_jobs_by_process_instance = (state, process_instance_id) =>
  GET(
    `/job?processInstanceId=${process_instance_id}`,
    state,
    state.api.job.by_process_instance,
  );

const job = {
  by_process_instance: get_jobs_by_process_instance,
};

export default job;
