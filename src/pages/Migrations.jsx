import { signal } from "@preact/signals";
import { useContext } from "preact/hooks";
import engine_rest, { RequestState } from "../api/engine_rest.jsx";
import { AppState } from "../state.js";
import { createContext } from "preact";
import ReactBpmn from "react-bpmn";
import BpmnModdle from "bpmn-moddle";
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
        const params_as_string = Object.entries(query).map(
          ([k, v]) => `&${k}=${v}`
        ).join('');
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

  console.log(query)

  if (query.source) {
    migration_state.source.value = query.source
    engine_rest.process_definition.diagram(
      state,
      migration_state.source.value,
      migration_state.source_diagram,
    );
  }
  if (query.target) {
    migration_state.target.value = query.target
    engine_rest.process_definition.diagram(
      state,
      migration_state.target.value,
      migration_state.target_diagram,
    );
  }

  return (
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
        }}
      >
        <option disabled selected>-- select source ---</option>
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
      <br />
      <br />

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
        <option disabled selected>-- select target ---</option>
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

      <h2>Mappings</h2>

      <button
        onClick={() =>
          engine_rest.migration.generate(
            state,
            migration_state.source.value,
            migration_state.target.value,
          )
        }
      >
        Generate Mapping
      </button>

      <RequestState
        state={state}
        signal={state.api.migration.generate}
        on_success={() => (
          <ul>
            {state.api.migration.generate.value.data.instructions.map(
              (instruction, index) => (
                <li key={index}>
                  {instruction.sourceActivityIds[0]} →{" "}
                  {instruction.targetActivityIds[0]}
                </li>
              ),
            )}
          </ul>
        )}
      />

      <div class="migration-diagrams">
        <div>
          <h3>Source Diagram</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.source_diagram}
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
          <h3>Target Diagram</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.target_diagram}
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
