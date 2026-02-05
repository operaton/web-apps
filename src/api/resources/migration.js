import { POST } from "../helper.jsx";

const generate = (
  state,
  source_process_definition_id,
  target_process_definition_id,
  variables = {},
  update_event_triggers = true,
) =>
  POST(
    `/migration/generate`,
    {
      sourceProcessDefinitionId: source_process_definition_id,
      targetProcessDefinitionId: target_process_definition_id,
      variables: variables,
      updateEventTriggers: update_event_triggers,
    },
    state,
    state.api.migration.generate,
  );

const validate = (state, migration_plan) =>
  POST(
    `/migration/validate`,
    migration_plan,
    state,
    state.api.migration.validation,
  );

const execute = (
  state,
  migration_plan,
  process_instances,
  skip_custom_listeners = false,
) =>
  POST(
    `/migration/execute`,
    {
      migrationPlan: migration_plan,
      processInstanceIds: process_instances,
      skipCustomListeners: skip_custom_listeners,
    },
    state,
    state.api.migration.execution,
  );

const migration = {
  generate,
  validate,
  execute,
};

export default migration;
