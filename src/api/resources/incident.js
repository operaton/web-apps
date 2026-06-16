import { DELETE, GET, PUT } from "../helper.jsx";

const get_incidents_by_process_definition = (state, definition_id) =>
  GET(
    `/incident?processDefinitionId=${definition_id}`,
    state,
    state.api.incident.by_process_definition,
  );

const get_incidents_by_process_instance = (state, instance_id) =>
  GET(
    `/incident?processInstanceId=${instance_id}`,
    state,
    state.api.incident.by_process_instance,
  );

const set_annotation = (state, id, annotation) =>
  PUT(
    `/incident/${id}/annotation`,
    { annotation },
    state,
    state.api.incident.annotation,
  );

const clear_annotation = (state, id) =>
  DELETE(
    `/incident/${id}/annotation`,
    null,
    state,
    state.api.incident.annotation,
  );

const incident = {
  by_process_definition: get_incidents_by_process_definition,
  by_process_instance: get_incidents_by_process_instance,
  set_annotation,
  clear_annotation,
};

export default incident;
