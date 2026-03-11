import { signal } from "@preact/signals";
import { useContext } from "preact/hooks";
import { useTranslation } from "react-i18next";
import engine_rest, { RequestState } from "../api/engine_rest.jsx";
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
    variables = signal([]),
    process_instance_query = signal([]);

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
    process_instance_query,
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

const QUERY_FIELDS_KEYS = [
  { name: "processInstanceIds", labelKey: "migrations.query-fields.id", type: "array" },
  { name: "businessKey", labelKey: "migrations.query-fields.business-key", type: "text" },
  { name: "superProcessInstance", labelKey: "migrations.query-fields.parent-id", type: "text" },
  { name: "subProcessInstance", labelKey: "migrations.query-fields.sub-id", type: "text" },
  { name: "active", labelKey: "migrations.query-fields.active", type: "boolean" },
  { name: "suspended", labelKey: "migrations.query-fields.suspended", type: "boolean" },
  {
    name: "rootProcessInstances",
    labelKey: "migrations.query-fields.root-instances-only",
    type: "boolean",
  },
  {
    name: "leafProcessInstances",
    labelKey: "migrations.query-fields.leaf-instances-only",
    type: "boolean",
  },
  { name: "withIncident", labelKey: "migrations.query-fields.with-incidents-only", type: "boolean" },
  { name: "incidentId", labelKey: "migrations.query-fields.incident-id", type: "text" },
  { name: "incidentType", labelKey: "migrations.query-fields.incident-type", type: "text" },
  { name: "incidentMessage", labelKey: "migrations.query-fields.incident-message", type: "text" },
  { name: "tenantIdIn", labelKey: "migrations.query-fields.tenant-id", type: "array" },
  { name: "activityIdIn", labelKey: "migrations.query-fields.activity-id", type: "array" },
  { name: "withoutTenantId", labelKey: "migrations.query-fields.without-tenant-id", type: "boolean" },
];

const VARIABLE_TYPES = [
  "String",
  "Integer",
  "Long",
  "Double",
  "Boolean",
  "Date",
];

const ProcessSelection = () => {
  const state = useContext(AppState),
    { api: { process: { definition: { list }, }, }, } = state,
    migration_state = useContext(MigrationState),
    { route, url, query, path } = useLocation(),
    [t] = useTranslation(),
    add_query_params = (name, value) => add_query_params_abstract(query, url, route, path, name, value),
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
      <h1 class="screen-hidden">{t("migrations.title")}</h1>
      <div>
        <section>
          <h2 class="screen-hidden">{t("migrations.process-selection")}</h2>
          <div>
            <div>
              <label>{t("migrations.source")} </label>
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
                  {t("migrations.select-source")}
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
              <label>{t("migrations.target")} </label>
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
                }}>
                <option disabled selected>{t("migrations.select-target")}</option>
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
                {t("migrations.select-definitions-hint")}
              </small>
            </p>
          )}
          on_success={() => <Mappings />}
        />

        <hr />

        <ProcessInstanceSelection />

        <RequestState
          signal={[
            state.api.process.instance.by_defintion_id,
            state.api.migration.validation,
          ]}
          on_nothing={() => <></>}
          on_success={() =>
            state.api.migration.validation.value.data.instructionReports
              .length > 0 ? (
              <></>
            ) : (
              <section>
                <h2>{t("migrations.process-instance-query")}</h2>
                <ProcessInstanceQuery />
              </section>
            )
          }
        />

        <RequestState
          signal={[
            state.api.process.instance.by_defintion_id,
            state.api.migration.validation,
          ]}
          on_nothing={() => <></>}
          on_success={() =>
            state.api.migration.validation.value.data.instructionReports
              .length > 0 ? (
              <></>
            ) : (
              <Variables />
            )
          }
        />

        <RequestState
          signal={state.api.migration.execution}
          on_nothing={() => <></>}
          on_success={() => <p>{t("migrations.success")}</p>}
          on_error={
            <p class="error">
              <strong>{t("migrations.failed")} </strong>
              {state.api.migration.execution.value?.error?.message ??
                t("migrations.unknown-error")}
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
              instructions: Object.keys(migration_state.mappings.peek()).map(
                (key) => ({
                  sourceActivityIds: [key],
                  targetActivityIds: [migration_state.mappings.peek()[key]],
                  updateEventTrigger: false,
                }),
              ),
              variables: variables_map,
            };
            const selected_ids = Object.entries(
                migration_state.selected_process_instances.peek(),
              )
                .filter(([, v]) => v)
                .map(([k]) => k),
              query_obj = build_query(
                migration_state.process_instance_query.peek(),
              ),
              has_query = Object.keys(query_obj).length > 0;
            engine_rest.migration.execute(
              state,
              migration_plan,
              selected_ids.length > 0 ? selected_ids : null,
              has_query ? query_obj : null,
              execute_form_data.peek().skip_custom_listeners,
              execute_form_data.peek().skip_io_mappings,
              execute_form_data.peek().async,
            );
          }}
        >
          <label for="async">{t("migrations.async")}</label>
          <input
            type="checkbox"
            id="async"
            name="async"
            onInput={(e) =>
              (execute_form_data.value = {
                ...execute_form_data.peek(),
                async: e.currentTarget.checked,
              })
            }
          />

          <label for="skip_custom_listeners">{t("migrations.skip-custom-listeners")}</label>
          <input
            type="checkbox"
            id="skip_custom_listeners"
            name="skip_custom_listeners"
            onInput={(e) =>
              (execute_form_data.value = {
                ...execute_form_data.peek(),
                skip_custom_listeners: e.currentTarget.checked,
              })
            }
          />

          <label for="skip_io_mappings">{t("migrations.skip-io-mappings")}</label>
          <input
            type="checkbox"
            id="skip_io_mappings"
            name="skip_io_mappings"
            onInput={(e) =>
              (execute_form_data.value = {
                ...execute_form_data.peek(),
                skip_io_mappings: e.currentTarget.checked,
              })
            }
          />

          <div class="button-group">
            <button type="submit">{t("migrations.execute")}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Diagrams = () => {
  const migration_state = useContext(MigrationState),
    [t] = useTranslation();

  return (
    // <div class="migration-diagrams">
    <section>
      <h2 class="screen-hidden">{t("migrations.diagrams")}</h2>
      <div class="migration-diagrams">
        <div>
          <h3 class="screen-hidden">{t("migrations.source")}</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.source_diagram}
            on_nothing={() => (
              <p>
                <small>{t("migrations.select-source-definition")}</small>
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
          <h3 class="screen-hidden">{t("migrations.target")}</h3>
          <RequestState
            state={migration_state}
            signal={migration_state.target_diagram}
            on_nothing={() => (
              <p>
                <small>{t("migrations.select-target-definition")}</small>
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
    const { [source_activity.id]: _, ...rest } =
      migration_state.mappings.peek();
    migration_state.mappings.value = rest;
  }

  validate(state, migration_state);
};

const generate_mapping_rows = (migration_state, state, t) => (
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
              <option value="">{t("migrations.do-not-map")}</option>

              {migration_state.target_activities.value.data.map(
                (target_activity) => (
                  <option
                    key={target_activity.id}
                    value={target_activity.id}
                    selected={
                      migration_state.mappings.value[source_activity.id] ===
                      target_activity.id
                    }
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
              on_nothing={() => <p>{t("migrations.not-validated")}</p>}
              on_success={() => (
                <p>
                  {state.api.migration.validation.value.data.instructionReports.some(
                    (report) =>
                      report.instruction.sourceActivityIds[0] ===
                      source_activity.id,
                  )
                    ? t("common.no")
                    : t("common.yes")}
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
    migration_state = useContext(MigrationState),
    [t] = useTranslation();

  if (
    has_data(state.api.migration.generate) &&
    Object.keys(migration_state.mappings.peek()).length > 0
  ) {
    validate(state, migration_state);
  }

  return (
    <>
      <h2 class="screen-hidden">{t("migrations.mappings")}</h2>

      <RequestState
        signal={state.api.migration.generate}
        on_nothing={() => (
          <small>
            {t("migrations.select-definitions-hint")}
          </small>
        )}
        on_success={() => (
          <>
            <table>
              <thead>
                <tr>
                  <th scope="column">{t("migrations.source-activity")}</th>
                  <th scope="column">{t("migrations.target-activity")}</th>
                  <th scope="column">{t("migrations.valid")}</th>
                </tr>
              </thead>
              <tbody>{generate_mapping_rows(migration_state, state, t)}</tbody>
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
                <h3>{t("migrations.validation-errors")}</h3>
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
  const migration_state = useContext(MigrationState),
    [t] = useTranslation();

  return (
    <>
      <h2>{t("migrations.variables")}</h2>
      {migration_state.variables.value.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="column">{t("common.name")}</th>
              <th scope="column">{t("common.type")}</th>
              <th scope="column">{t("common.value")}</th>
              <th scope="column">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {migration_state.variables.value.map((variable, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={variable.name}
                    placeholder={t("migrations.variable-name")}
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
                    placeholder={t("common.value")}
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
                    {t("common.remove")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div class="button-group">
        <button type="button" onClick={() => add_variable(migration_state)}>
          {t("migrations.add-variable")}
        </button>
      </div>
    </>
  );
};

const add_query_row = (migration_state) =>
  (migration_state.process_instance_query.value = [
    ...migration_state.process_instance_query.value,
    { field: QUERY_FIELDS_KEYS[0].name, value: "" },
  ]);

const remove_query_row = (migration_state, index) =>
  (migration_state.process_instance_query.value =
    migration_state.process_instance_query.value.filter((_, i) => i !== index));

const update_query_row = (migration_state, index, key, value) => {
  const updated = [...migration_state.process_instance_query.value];
  updated[index] = { ...updated[index], [key]: value };
  if (key === "field") {
    const field_def = QUERY_FIELDS_KEYS.find((f) => f.name === value);
    updated[index].value = field_def?.type === "boolean" ? "true" : "";
  }
  migration_state.process_instance_query.value = updated;
};

const build_query = (rows) => {
  const query = {};
  for (const { field, value } of rows) {
    if (value === "") continue;
    const field_def = QUERY_FIELDS_KEYS.find((f) => f.name === field);
    if (!field_def) continue;
    if (field_def.type === "boolean") query[field] = value === "true";
    else if (field_def.type === "array")
      query[field] = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else query[field] = value;
  }
  return query;
};

const ProcessInstanceQuery = () => {
  const migration_state = useContext(MigrationState),
    [t] = useTranslation();

  return (
    <>
      <small>
        {t("migrations.query-hint-prefix")}{" "}
        <code>processDefinitionId: "source process definition ID"</code>{" "}
        {t("migrations.query-hint-suffix")}
      </small>
      {migration_state.process_instance_query.value.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t("migrations.filter")}</th>
              <th>{t("common.value")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {migration_state.process_instance_query.value.map((row, index) => {
              const field_def = QUERY_FIELDS_KEYS.find((f) => f.name === row.field);
              return (
                <tr key={index}>
                  <td>
                    <select
                      value={row.field}
                      onChange={(e) =>
                        update_query_row(
                          migration_state,
                          index,
                          "field",
                          e.target.value,
                        )
                      }
                    >
                      {QUERY_FIELDS_KEYS.map(({ name, labelKey }) => (
                        <option key={name} value={name}>
                          {t(labelKey)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {field_def?.type === "boolean" ? (
                      <select
                        value={row.value}
                        onChange={(e) =>
                          update_query_row(
                            migration_state,
                            index,
                            "value",
                            e.target.value,
                          )
                        }
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={row.value}
                        placeholder={
                          field_def?.type === "array" ? "value1, value2" : ""
                        }
                        onInput={(e) =>
                          update_query_row(
                            migration_state,
                            index,
                            "value",
                            e.target.value,
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => remove_query_row(migration_state, index)}
                    >
                      {t("common.remove")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div class="button-group">
        <button type="button" onClick={() => add_query_row(migration_state)}>
          {t("migrations.add-filter")}
        </button>
      </div>
    </>
  );
};

const ProcessInstanceSelection = () => {
  const state = useContext(AppState),
    migration_state = useContext(MigrationState),
    [t] = useTranslation(),
    has_errors = () =>
      state.api.migration.validation.value.data.instructionReports.length > 0;

  return (
    <RequestState
      signal={[
        state.api.process.instance.by_defintion_id,
        state.api.migration.validation,
      ]}
      on_nothing={() => (
        <small>{t("migrations.define-mappings-hint")}</small>
      )}
      on_success={() =>
        has_errors() ? (
          <p>
            {t("migrations.invalid-mappings")}
          </p>
        ) : (
          <>
            <h2>{t("migrations.select-instances")}</h2>
            {state.api.process.instance.by_defintion_id.value.data.length ===
            0 ? (
              <p>{t("migrations.no-processes-for-migration")}</p>
            ) : (
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
                          (migration_state.selected_process_instances.value = {
                            ...migration_state.selected_process_instances.peek(),
                            [id]: e.target.checked,
                          })
                        }
                      />

                      <label key={id} for={id}>
                        {id}
                      </label>
                    </>
                  ),
                )}
              </form>
            )}
          </>
        )
      }
    />
  );
};

export { MigrationsPage };
