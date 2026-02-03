import { POST } from "../helper.jsx";

const generate = (
  state, 
  source_process_definition_id, 
  target_process_definition_id,
  variables = {}, 
  update_event_triggers = true
) =>
  POST(`/migration/generate`, 
    { sourceProcessDefinitionId: source_process_definition_id, 
      targetProcessDefinitionId: target_process_definition_id, 
      variables: variables,
      updateEventTriggers: update_event_triggers }, 
    state, 
    state.api.migration.generate);

const migration = {
  generate,
};

export default migration;
