import { GET } from "../helper.jsx";

const get_external_tasks_by_process_instance = (state, process_instance_id) =>
  GET(
    `/external-task?processInstanceId=${process_instance_id}`,
    state,
    state.api.external_task.by_process_instance,
  );

const external_task = {
  by_process_instance: get_external_tasks_by_process_instance,
};

export default external_task;
