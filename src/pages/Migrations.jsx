import { signal } from "@preact/signals";
import { useContext, useEffect } from "preact/hooks";
import engine_rest, {
  RequestState,
  RESPONSE_STATE,
} from "../api/engine_rest.jsx";
import { AppState } from "../state.js";
import { createContext } from "preact";
import ReactBpmn from "react-bpmn";
import BpmnModdle from "bpmn-moddle";
import { diff } from "bpmn-js-differ";
import { useLocation } from "preact-iso/router";

const create_mirgation_state = () => {
  const source = signal(null),
    source_diagram = signal(null),
    source_activities = signal(null),
    target = signal(null),
    target_diagram = signal(null),
    target_activities = signal(null);

  return {
    source,
    source_diagram,
    source_activities,
    target,
    target_diagram,
    target_activities,
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

const ProcessSelection = () => {
  const state = useContext(AppState),
    migration_state = useContext(MigrationState),
    { route, url, query, path } = useLocation(),
    add_query_params = (name, value) => {
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
    },
    {
      api: {
        process: {
          definition: { list },
        },
      },
    } = state;

  if (query.source) {
    migration_state.source.value = query.source;
    void engine_rest.process_definition
      .diagram(
        state,
        migration_state.source.value,
        migration_state.source_diagram,
      )
      .then(() => {
        bpmnModdle
          .fromXML(migration_state.source_diagram.value.data?.bpmn20Xml)
          .then(
            ({ rootElement: definitions }) =>
              (migration_state.source_activities.value = {
                status: "SUCCESS",
                data: definitions.rootElements
                  .find(({ id }) => id === "invoice")
                  .flowElements.filter(
                    ({ isImmediate, $type }) =>
                      !isImmediate && $type !== "bpmn:SequenceFlow",
                  ),
              }),
          );
      });

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
      .then(() => {
        console.log(migration_state.target_diagram.value.data?.bpmn20Xml);
        bpmnModdle
          .fromXML(migration_state.target_diagram.value.data?.bpmn20Xml)
          .then(
            ({ rootElement: definitions }) =>
              (migration_state.target_activities.value = {
                status: "SUCCESS",
                data: definitions.rootElements
                  .find(({ id }) => id === "invoice")
                  .flowElements.filter(
                    ({ isImmediate, $type }) =>
                      !isImmediate && $type !== "bpmn:SequenceFlow",
                  ),
              }),
          )
          .then(() => console.log("done", migration_state.target_activities));
      });
  }

  if (query.source && query.target) {
    engine_rest.migration.generate(
      state,
      migration_state.source.value,
      migration_state.target.value,
    );
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
                  engine_rest.migration.generate(
                    state,
                    migration_state.source.value,
                    migration_state.target.value,
                  );
                }}
              >
                <option disabled selected>
                  -- Select source ---
                </option>
                <RequestState
                  state={state}
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
                  engine_rest.migration.generate(
                    state,
                    migration_state.source.value,
                    migration_state.target.value,
                  );
                }}
              >
                <option disabled selected>
                  -- Select target ---
                </option>
                <RequestState
                  state={state}
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
          on_success={() => <Mappings />}
        />

        <hr />

        <ProcessInstanceSelection />

        <RequestState
          state={state}
          signal={state.api.migration.execution}
          on_nothing={() => <></>}
          on_success={() => (
            <>
              {state.api.migration.execution.value.status ===
              RESPONSE_STATE.SUCCESS
                ? "Migration successfull"
                : "Migration failed"}
            </>
          )}
        />
      </div>
      <div id="execute">
        <button
          onClick={() =>
            engine_rest.migration
              .execute(
                state,
                state.api.migration.generate.value.data,
                state.api.process.instance.by_defintion_id.value.data.map(
                  ({ id }) => id,
                ),
                true,
              )
              .then(() => console.log(state.api.migration.execution.value))
          }
        >
          Execute Migration
        </button>
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
            on_nothing={() => <p>Select source process defintion</p>}
            on_success={() => (
              <ReactBpmn
                diagramXML={
                  migration_state.source_diagram.value.data?.bpmn20Xml
                }
                onShown={() => console.log("shown")}
                onLoading={() => console.log("loading")}
                onError={() => console.log("error")}
              />
            )}
          />
        </div>
        <div>
          <h3 class="screen-hidden">Target</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.target_diagram}
            on_nothing={() => <p>Select target process defintion</p>}
            on_success={() => (
              <ReactBpmn
                diagramXML={
                  migration_state.target_diagram.value.data?.bpmn20Xml
                }
                onShown={() => console.log("shown")}
                onLoading={() => console.log("loading")}
                onError={() => console.log("error")}
              />
            )}
          />
        </div>
      </div>
      {/* </div>*/}
    </section>
  );
};

const Mappings = () => {
  const state = useContext(AppState),
    migration_state = useContext(MigrationState);

  return (
    <>
      <h2 class="screen-hidden">Mappings</h2>

      <RequestState
        state={state}
        signal={state.api.migration.generate}
        on_nothing={() => <></>}
        on_success={() => {
          return (
            <>
              <table>
                <thead>
                  <tr>
                    <th scope="column">Source Activity</th>
                    <th scope="column">Target Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {migration_state.target_activities.value !== null &&
                  migration_state.source_activities.value !== null ? (
                    // state.api.migration.generate.value.data.instructions
                    migration_state.source_activities.value.data.map(
                      (source_activity) => (
                        <tr key={source_activity.id}>
                          <td>{source_activity.name}</td>
                          <td>
                            <select>
                              <option value="">-- none -- (do not map)</option>
                              {/* {instruction.targetActivityIds[0]}*/}

                              {migration_state.target_activities.value.data.map(
                                (target_activity) => (
                                  <option
                                    key={target_activity.id}
                                    value={target_activity.id}
                                    selected={state.api.migration.generate.value.data.instructions.find(
                                      ({
                                        sourceActivityIds,
                                        targetActivityIds,
                                      }) =>
                                        sourceActivityIds[0] ===
                                          source_activity.id &&
                                        targetActivityIds[0] ===
                                          target_activity.id,
                                    )}
                                  >
                                    {target_activity.name} ({target_activity.id}
                                    )
                                  </option>
                                ),
                              )}
                            </select>
                          </td>
                        </tr>
                      ),
                    )
                  ) : (
                    <p>Loading...</p>
                  )}
                </tbody>
              </table>

              <button
                onClick={() =>
                  engine_rest.migration.validate(
                    state,
                    state.api.migration.generate.value.data,
                  )
                }
              >
                Validate Mapping
              </button>
            </>
          );
        }}
      />
    </>
  );
};

const ProcessInstanceSelection = () => {
  const state = useContext(AppState);

  return (
    <>
      <RequestState
        state={state}
        signal={state.api.process.instance.by_defintion_id}
        on_success={() => (
          <RequestState
            state={state}
            signal={state.api.migration.validation}
            on_nothing={() => <></>}
            on_success={() => (
              <>
                <h2 class="screen-hidden">
                  Process Instances of Source Defintion
                </h2>
                <ul>
                  {state.api.process.instance.by_defintion_id.value.data.map(
                    ({ id }) => (
                      <li key={id}>{id}</li>
                    ),
                  )}
                </ul>
              </>
            )}
          />
        )}
      />
    </>
  );
};

export { MigrationsPage };
