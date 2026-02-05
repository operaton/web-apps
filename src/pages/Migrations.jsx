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
import { useLocation, useRoute } from "preact-iso/router";

const create_mirgation_state = () => {
  const source = signal(null),
    source_diagram = signal(null),
    target = signal(null),
    target_diagram = signal(null);

  return {
    source,
    source_diagram,
    target,
    target_diagram,
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
    void engine_rest.process_definition.diagram(
      state,
      migration_state.source.value,
      migration_state.source_diagram,
    );

    void engine_rest.process_instance.by_defintion_id(
      state,
      migration_state.source.value,
    );
  }
  if (query.target) {
    migration_state.target.value = query.target;
    engine_rest.process_definition.diagram(
      state,
      migration_state.target.value,
      migration_state.target_diagram,
    );
  }

  if (query.source && query.target) {
    engine_rest.migration.generate(
      state,
      migration_state.source.value,
      migration_state.target.value,
    );
  }

  // useEffect(() => {
  //   if (
  //     migration_state.source_diagram.value !== null &&
  //     migration_state.source_diagram.value.data !== null
  //   ) {
  //     const bpmnModdle = new BpmnModdle();

  //     console.log("xml", migration_state.source_diagram.value.data?.bpmn20Xml);

  //     // const { rootElement: definitionsA } = await;
  //     bpmnModdle
  //       .fromXML(migration_state.source_diagram.value.data?.bpmn20Xml)
  //       .then(({ rootElement: definitions }) =>
  //         console.log("diff moddle", definitions),
  //       );
  //   }

  //   console.log(
  //     "diff",
  //     diff(
  //       migration_state.source_diagram.value.data?.bpmn20Xml,
  //       migration_state.target_diagram.value.data?.bpmn20Xml,
  //     ),
  //   );
  // });

  return (
    <div id="migration">
      <h1 class="screen-hidden">Migrations</h1>
      <section>
        <h2>Process Defintion Selection</h2>
        <div class="row">
          <div>
            <label>Source Process Definition</label>
            <br />
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
            <label>Target Process Definition</label>
            <br />
            <select
              onChange={(e) => {
                migration_state.target.value = e.target.value;
                add_query_params("target", migration_state.target.value);
                engine_rest.process_definition.diagram(
                  state,
                  migration_state.target.value,
                  migration_state.target_diagram,
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

          <button
            onClick={() =>
              engine_rest.migration.generate(
                state,
                migration_state.source.value,
                migration_state.target.value,
              )
            }
            disabled={
              migration_state.source.value === null ||
              migration_state.target.value === null
            }
          >
            Generate Mapping
          </button>
        </div>
      </section>

      <h2>Mappings</h2>

      <RequestState
        state={state}
        signal={state.api.migration.generate}
        on_nothing={() => <></>}
        on_success={() => (
          <>
            <table>
              <thead>
                <tr>
                  <th scope="column">Source Activity</th>
                  <th scope="column">Target Activity</th>
                </tr>
              </thead>
              <tbody>
                {state.api.migration.generate.value.data.instructions.map(
                  (instruction, index) => (
                    <tr key={index}>
                      <td>{instruction.sourceActivityIds[0]}</td>
                      <td>
                        <select>
                          <option>{instruction.targetActivityIds[0]}</option>
                        </select>
                      </td>
                    </tr>
                  ),
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
        )}
      />

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
                <h2>Process Instances of Source Defintion</h2>
                <ul>
                  {state.api.process.instance.by_defintion_id.value.data.map(
                    ({ id }) => (
                      <li key={id}>{id}</li>
                    ),
                  )}
                </ul>
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
                      .then(() =>
                        console.log(state.api.migration.execution.value),
                      )
                  }
                >
                  Execute Migration
                </button>
              </>
            )}
          />
        )}
      />

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

      <div class="migration-diagrams">
        <div>
          <h3>Source Diagram</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.source_diagram}
            on_nothing={() => <p>Select source process defintion</p>}
            on_success={() => {
              const bpmnModdle = new BpmnModdle();

              // const { rootElement: definitionsA } = await;
              bpmnModdle
                .fromXML(migration_state.source_diagram.value.data?.bpmn20Xml)
                .then(({ rootElement: definitions }) =>
                  console.log(
                    "diff moddle",
                    definitions.rootElements.find(({ id }) => id === "invoice"),
                    // .flowElements.filter(({ isImmediate }) => !isImmediate),
                  ),
                );

              return (
                <ReactBpmn
                  diagramXML={
                    migration_state.source_diagram.value.data?.bpmn20Xml
                  }
                  onShown={() => console.log("shown")}
                  onLoading={() => console.log("loading")}
                  onError={() => console.log("error")}
                />
              );
            }}
          />
        </div>
        <div>
          <h3>Target Diagram</h3>
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
    </div>
  );
};

export { MigrationsPage };
