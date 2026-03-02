import { signal } from "@preact/signals";
import { useContext } from "preact/hooks";
import engine_rest, {
  RequestState,
  RESPONSE_STATE,
} from "../api/engine_rest.jsx";
import { AppState } from "../state.js";
import { createContext } from "preact";
import ReactBpmn from "react-bpmn";
import BpmnModdle from "bpmn-moddle";
import { useLocation } from "preact-iso/router";
import { has_data } from "../api/helper.jsx";

const create_mirgation_state = () => {
  const source = signal(null),
    source_diagram = signal(null),
    source_activities = signal(null),
    target = signal(null),
    target_diagram = signal(null),
    target_activities = signal(null),
    mappings = signal({}),
    selected_process_instances = signal({}),
    variables = signal([]);

  return {
    source,
    source_diagram,
    source_activities,
    target,
    target_diagram,
    target_activities,
    mappings,
    selected_process_instances,
    variables,
  };
};

const MigrationState = createContext(undefined);

const MigrationsPage = () => {
  const state = useContext(AppState);

  void engine_rest.process_definition.list(state);

  return (
    <MigrationState.Provider value={create_mirgation_state()}>
      <main>
        <ProcessSelection />
      </main>
    </MigrationState.Provider>
  );
};

const bpmnModdle = new BpmnModdle();

/**
 * Takes the XML representation of a BPMN diagram, gets all the activities and
 * filters for non-immediate and mappable activity types
 * @param {*} diagram_signal
 * @param {*} activities_signal
 * @returns
 */
const find_activities_of_diagram = (diagram_signal, activities_signal) =>
  bpmnModdle
    .fromXML(diagram_signal.value.data?.bpmn20Xml)
    .then(({ rootElement: definitions }) => {
      return (activities_signal.value = {
        status: "SUCCESS",
        data: definitions.rootElements
          .find(({ $type }) => $type === "bpmn:Process")
          .flowElements.filter(({ isImmediate, $type }) => {
            // console.log($type);
            return !(
              isImmediate ||
              $type === "bpmn:SequenceFlow" ||
              $type === "bpmn:DataStoreReference"
            );
          }),
      });
    });

const validate = (state, migration_state) => {
  if (
    migration_state.mappings.peek() !== null &&
    state.api.migration.generate.peek() !== null &&
    state.api.migration.generate.peek().data !== null
  ) {
    const migration_plan = {
      ...state.api.migration.generate.peek().data,
      instructions: Object.keys(migration_state.mappings.peek()).map((key) => ({
        sourceActivityIds: [key],
        targetActivityIds: [migration_state.mappings.peek()[key]],
        updateEventTrigger: false,
      })),
    };

    engine_rest.migration.validate(state, migration_plan);
  }
};

const add_query_params_abstract = (query, url, route, path, name, value) => {
  if (Object.keys(query).length === 0) {
    route(`${url}?${name}=${value}`);
  } else if (query[name] !== null) {
    query[name] = value;
    const params_as_string = Object.entries(query)
      .map(([k, v]) => `&${k}=${v}`)
      .join("");
    route(`${path}?${params_as_string}`);
  } else {
    route(`${url}&${name}=${value}`);
  }
};

const generate_abstract = (migration_state, state) =>
  migration_state.source.value !== null && migration_state.target.value !== null
    ? engine_rest.migration
        .generate(
          state,
          migration_state.source.value,
          migration_state.target.value,
        )
        .then(
          () =>
            (migration_state.mappings.value = Object.fromEntries(
              state.api.migration.generate.value.data.instructions.map(
                (instruction) => [
                  instruction.sourceActivityIds[0],
                  instruction.targetActivityIds[0],
                ],
              ),
            )),
        )
    : null;

const ProcessSelection = () => {
  const state = useContext(AppState),
    {
      api: {
        process: {
          definition: { list },
        },
      },
    } = state,
    migration_state = useContext(MigrationState),
    { route, url, query, path } = useLocation(),
    add_query_params = (name, value) =>
      add_query_params_abstract(query, url, route, path, name, value),
    generate = () => generate_abstract(migration_state, state),
    execute_form_data = signal({
      async: false,
      skip_io_mappings: false,
      skip_custom_listeners: false,
    });

  if (query.source === undefined || query.target === undefined) {
    console.log("clear state");
    state.api.migration.validation.value = null;
    state.api.migration.generate.value = null;
    state.api.process.instance.by_defintion_id.value = null;
  }

  if (query.source) {
    migration_state.source.value = query.source;
    void engine_rest.process_definition
      .diagram(
        state,
        migration_state.source.value,
        migration_state.source_diagram,
      )
      .then(() =>
        find_activities_of_diagram(
          migration_state.source_diagram,
          migration_state.source_activities,
        ),
      );

    void engine_rest.process_instance.by_defintion_id(
      state,
      migration_state.source.value,
    );
  }
  if (query.target) {
    migration_state.target.value = query.target;
    engine_rest.process_definition
      .diagram(
        state,
        migration_state.target.value,
        migration_state.target_diagram,
      )
      .then(() =>
        find_activities_of_diagram(
          migration_state.target_diagram,
          migration_state.target_activities,
        ),
      );
  }

  if (query.source && query.target) {
    generate();
  }

  return (
    <div id="migration">
      <h1 class="screen-hidden">Migrations</h1>
      <div>
        <section>
          <h2 class="screen-hidden">Process Defintion Selection</h2>
          <div>
            <div>
              <label>Source </label>
              <select
                onChange={(e) => {
                  // @ts-ignore
                  migration_state.source.value = e.target.value;
                  add_query_params("source", migration_state.source.value);
                  engine_rest.process_definition.diagram(
                    state,
                    migration_state.source.value,
                    migration_state.source_diagram,
                  );
                  engine_rest.process_instance.by_defintion_id(
                    state,
                    migration_state.source.value,
                  );
                  generate().then(() => validate(state, migration_state));
                }}
              >
                <option disabled selected>
                  -- Select source ---
                </option>
                <RequestState
                  signal={list}
                  on_success={() =>
                    list.value.data.map(({ id, definition }) => (
                      <option
                        key={id}
                        disabled={migration_state.target.value == id}
                        selected={migration_state.source.value == id}
                        value={id}
                      >
                        {definition.name} – v{definition.version}
                      </option>
                    ))
                  }
                />
              </select>
            </div>

            <div>
              <label>Target </label>
              <select
                onChange={(e) => {
                  migration_state.target.value = e.target.value;
                  add_query_params("target", migration_state.target.value);
                  engine_rest.process_definition.diagram(
                    state,
                    migration_state.target.value,
                    migration_state.target_diagram,
                  );
                  generate().then(() => validate(state, migration_state));
                }}
              >
                <option disabled selected>
                  -- Select target ---
                </option>
                <RequestState
                  signal={list}
                  on_success={() =>
                    list.value.data.map(({ id, definition }) => (
                      <option
                        key={id}
                        disabled={migration_state.source.value == id}
                        selected={migration_state.target.value == id}
                        value={id}
                      >
                        {definition.name} – v{definition.version}
                      </option>
                    ))
                  }
                />
              </select>
            </div>
          </div>
        </section>

        <Diagrams />

        <hr />

        <RequestState
          state={migration_state}
          signal={migration_state.target_activities}
          on_nothing={() => (
            <p>
              <small>
                Select process definitions to define the migration mappings
              </small>
            </p>
          )}
          on_success={() => <Mappings />}
        />

        <hr />

        <ProcessInstanceSelection />

        <Variables />

        <RequestState
          signal={state.api.migration.execution}
          on_nothing={() => <></>}
          on_success={() => <p>Migration successful</p>}
          on_error={
            <p class="error">
              <strong>Migration failed: </strong>
              {state.api.migration.execution.value?.error?.message ??
                "Unknown error"}
            </p>
          }
        />
      </div>
      <div id="execute">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const variables_map = {};
            for (const v of migration_state.variables.peek()) {
              if (v.name.trim() !== "")
                variables_map[v.name] = { type: v.type, value: v.value };
            }
            const migration_plan = {
              ...state.api.migration.generate.peek().data,
              instructions: Object.keys(
                migration_state.mappings.peek(),
              ).map((key) => ({
                sourceActivityIds: [key],
                targetActivityIds: [migration_state.mappings.peek()[key]],
                updateEventTrigger: false,
              })),
              variables: variables_map,
            };
            engine_rest.migration.execute(
              state,
              migration_plan,
              Object.entries(
                migration_state.selected_process_instances.peek(),
              ).map(([k]) => k),
              null,
              execute_form_data.peek().skip_custom_listeners,
              execute_form_data.peek().skip_io_mappings,
              execute_form_data.peek().async,
            );
          }}
        >
          <label for="async">Async</label>
          <input
            type="checkbox"
            id="async"
            name="async"
            onInput={(e) =>
              (execute_form_data.value = { ...execute_form_data.peek(), async: e.currentTarget.checked })
            }
          />

          <label for="skip_custom_listeners">Skip Custom Listeners</label>
          <input
            type="checkbox"
            id="skip_custom_listeners"
            name="skip_custom_listeners"
            onInput={(e) =>
              (execute_form_data.value = { ...execute_form_data.peek(), skip_custom_listeners: e.currentTarget.checked })
            }
          />

          <label for="skip_io_mappings">Skip IO Mappings</label>
          <input
            type="checkbox"
            id="skip_io_mappings"
            name="skip_io_mappings"
            onInput={(e) =>
              (execute_form_data.value = { ...execute_form_data.peek(), skip_io_mappings: e.currentTarget.checked })
            }
          />

          <div class="button-group">
            <button type="submit">Execute Migration</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Diagrams = () => {
  const migration_state = useContext(MigrationState);

  return (
    // <div class="migration-diagrams">
    <section>
      <h2 class="screen-hidden">Diagrams</h2>
      <div class="migration-diagrams">
        <div>
          <h3 class="screen-hidden">Source</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.source_diagram}
            on_nothing={() => (
              <p>
                <small>Select source process defintion</small>
              </p>
            )}
            on_success={() => (
              <ReactBpmn
                diagramXML={
                  migration_state.source_diagram.value.data?.bpmn20Xml
                }
                onLoading={() => console.log("BPMN Diagram 1: loading")}
                onError={() => console.log("BPMN Diagram 1: error")}
              />
            )}
          />
        </div>
        <div>
          <h3 class="screen-hidden">Target</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.target_diagram}
            on_nothing={() => (
              <p>
                <small>Select target process defintion</small>
              </p>
            )}
            on_success={() => (
              <ReactBpmn
                diagramXML={
                  migration_state.target_diagram.value.data?.bpmn20Xml
                }
                onLoading={() => console.log("BPMN Diagram 2: loading")}
                onError={() => console.log("BPMN Diagram 2: error")}
              />
            )}
          />
        </div>
      </div>
      {/* </div>*/}
    </section>
  );
};

const update_mapping = (e, source_activity, migration_state, state) => {
  if (e.target.value !== "") {
    migration_state.mappings.value = {
      ...migration_state.mappings.peek(),
      [source_activity.id]: e.target.value,
    };
  } else {
    const { [source_activity.id]: _, ...rest } = migration_state.mappings.peek();
    migration_state.mappings.value = rest;
  }

  validate(state, migration_state);
};

const generate_mapping_rows = (migration_state, state) => (
  <RequestState
    signal={[
      migration_state.target_activities,
      migration_state.source_activities,
    ]}
    on_success={() =>
      migration_state.source_activities.value.data.map((source_activity) => (
        <tr key={source_activity.id}>
          <td>{source_activity.name}</td>
          <td>
            <select
              onChange={(e) =>
                update_mapping(e, source_activity, migration_state, state)
              }
            >
              <option value="">-- none -- (do not map)</option>

              {migration_state.target_activities.value.data.map(
                (target_activity) => (
                  <option
                    key={target_activity.id}
                    value={target_activity.id}
                    selected={migration_state.mappings.value[source_activity.id] === target_activity.id}
                  >
                    {target_activity.name} ({target_activity.id})
                  </option>
                ),
              )}
            </select>
          </td>
          <td>
            <RequestState
              signal={state.api.migration.validation}
              on_nothing={() => <p>Not validated</p>}
              on_success={() => (
                <p>
                  {state.api.migration.validation.value.data.instructionReports.some(
                    (report) =>
                      report.instruction.sourceActivityIds[0] ===
                      source_activity.id,
                  )
                    ? "invalid"
                    : "valid"}
                </p>
              )}
            />
          </td>
        </tr>
      ))
    }
  />
);

const Mappings = () => {
  const state = useContext(AppState),
    migration_state = useContext(MigrationState);

  if (
    has_data(state.api.migration.generate) &&
    Object.keys(migration_state.mappings.peek()).length > 0
  ) {
    validate(state, migration_state);
  }

  return (
    <>
      <h2 class="screen-hidden">Mappings</h2>

      <RequestState
        signal={state.api.migration.generate}
        on_nothing={() => (
          <small>
            Select process definitions to define the migration mappings
          </small>
        )}
        on_success={() => (
          <>
            <table>
              <thead>
                <tr>
                  <th scope="column">Source Activity</th>
                  <th scope="column">Target Activity</th>
                  <th scope="column">Valid</th>
                </tr>
              </thead>
              <tbody>{generate_mapping_rows(migration_state, state)}</tbody>
            </table>
          </>
        )}
      />

      <RequestState
        signal={state.api.migration.validation}
        on_nothing={() => <></>}
        on_success={() => (
          <div>
            {state.api.migration.validation.value.data.instructionReports
              .length > 0 ? (
              <>
                <h3>Valdiation errors</h3>
                <ul>
                  {state.api.migration.validation.value.data.instructionReports.map(
                    (report) =>
                      report.failures.map((failure) => (
                        <li key={failure.toString()}>{failure}</li>
                      )),
                  )}
                </ul>
              </>
            ) : null}
          </div>
        )}
      />
    </>
  );
};

const VARIABLE_TYPES = [
  "String",
  "Integer",
  "Long",
  "Double",
  "Boolean",
  "Date",
];

const add_variable = (migration_state) =>
  (migration_state.variables.value = [
    ...migration_state.variables.value,
    { name: "", type: "String", value: "" },
  ]);

const remove_variable = (migration_state, index) =>
  (migration_state.variables.value = migration_state.variables.value.filter(
    (_, i) => i !== index,
  ));

const update_variable = (migration_state, index, field, value) => {
  const updated = [...migration_state.variables.value];
  updated[index] = { ...updated[index], [field]: value };
  migration_state.variables.value = updated;
};

const Variables = () => {
  const migration_state = useContext(MigrationState);

  return (
    <>
      <h2>Variables</h2>
      {migration_state.variables.value.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="column">Name</th>
              <th scope="column">Type</th>
              <th scope="column">Value</th>
              <th scope="column"></th>
            </tr>
          </thead>
          <tbody>
            {migration_state.variables.value.map((variable, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={variable.name}
                    placeholder="Variable name"
                    onInput={(e) =>
                      update_variable(
                        migration_state,
                        index,
                        "name",
                        e.currentTarget.value,
                      )
                    }
                  />
                </td>
                <td>
                  <select
                    value={variable.type}
                    onChange={(e) =>
                      update_variable(
                        migration_state,
                        index,
                        "type",
                        e.target.value,
                      )
                    }
                  >
                    {VARIABLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={variable.value}
                    placeholder="Value"
                    onInput={(e) =>
                      update_variable(
                        migration_state,
                        index,
                        "value",
                        e.currentTarget.value,
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => remove_variable(migration_state, index)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div class="button-group">
        <button type="button" onClick={() => add_variable(migration_state)}>
          Add Variable
        </button>
      </div>
    </>
  );
};

const ProcessInstanceSelection = () => {
  const state = useContext(AppState),
    migration_state = useContext(MigrationState),
    has_errors = () =>
      state.api.migration.validation.value.data.instructionReports.length > 0;

  return (
    <RequestState
      signal={[
        state.api.process.instance.by_defintion_id,
        state.api.migration.validation,
      ]}
      on_nothing={() => (
        <small>Define mappings to select process instances for migration</small>
      )}
      on_success={() =>
        has_errors() ? (
          <p>
            Invalid mappings. To select process instances and execute the
            migration, first make sure your mappings are all valid.
          </p>
        ) : (
          <>
            <h2>Select Process Instances of Source Definition</h2>
            <form>
              {state.api.process.instance.by_defintion_id.value.data.map(
                ({ id }) => (
                  // eslint-disable-next-line react/jsx-key
                  <>
                    <input
                      type="checkbox"
                      id={id}
                      value={id}
                      onChange={(e) =>
                        (migration_state.selected_process_instances.value =
                          { ...migration_state.selected_process_instances.peek(), [id]: e.target.checked })
                      }
                    />

                    <label key={id} for={id}>
                      {id}
                    </label>
                  </>
                ),
              )}
            </form>
          </>
        )
      }
    />
  );
};

export { MigrationsPage };

/*
{
  "migrationPlan": {
    "sourceProcessDefinitionId": "invoice:2:451a34de-e771-11ee-9f50-6e21836f88b1",
    "targetProcessDefinitionId": "invoice:1:449b19c5-e771-11ee-9f50-6e21836f88b1",
    "instructions": [
      {
        "sourceActivityIds": [
          "prepareBankTransfer"
        ],
        "targetActivityIds": [
          "prepareBankTransfer"
        ],
        "updateEventTrigger": false
      },
      {
        "sourceActivityIds": [
          "approveInvoice"
        ],
        "targetActivityIds": [
          "approveInvoice"
        ],
        "updateEventTrigger": false
      },
      {
        "sourceActivityIds": [
          "ServiceTask_1"
        ],
        "targetActivityIds": [
          "ServiceTask_1"
        ],
        "updateEventTrigger": false
      },
      {
        "sourceActivityIds": [
          "reviewInvoice"
        ],
        "targetActivityIds": [
          "reviewInvoice"
        ],
        "updateEventTrigger": false
      }
    ],
    "variables": {
      "Test": {
        "type": "String",
        "value": "Hello World"
      }
    }
  },
  "skipIoMappings": true,
  "skipCustomListeners": true,
  "processInstanceQuery": {
    "active": true,
    "processDefinitionId": "invoice:2:451a34de-e771-11ee-9f50-6e21836f88b1"
  }
}
*/

/*

Process Instance Filter Query Params:

ID
Business Key
Parent ID
Sub ID
Variable
Active
Suspended
Root Instances Only
Leaf Instances Only
With Incidents Only
Incident ID
Incident Type
Incident Message
Tenant ID
Activity ID
Without Tenant ID

*/
