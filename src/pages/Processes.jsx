import { signal, useSignalEffect } from "@preact/signals";
import { useContext, useEffect } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { useTranslation } from "react-i18next";
import engine_rest, {
  RequestState,
  RESPONSE_STATE,
} from "../api/engine_rest.jsx";
import * as Icons from "../assets/icons.jsx";
import { AppState } from "../state.js";
import { Accordion } from "../components/Accordion.jsx";
import { BPMNViewer } from "../components/BPMNViewer.jsx";

/**
 * Save custom split view width to localstorage
 */
const store_details_width = () => {
  const width = window
    .getComputedStyle(document.getElementById("selection"), null)
    .getPropertyValue("width");
  localStorage.setItem("details_width", width);
  document.getElementById("canvas").style.maxWidth = `calc(100vw - ${width})`;
};

/**
 * Keep the `?history=true` query params of the URL alive as long as the history
 * mode is active.
 *
 * @param query Provide the result of `useRoute().query`
 * @returns {string} Either returns `?history=true` when history mode is active or an empty string when not.
 */
const keep_history_query = (query) => {
  if (query.history) {
    return "?history=true";
  }
  return "";
};

const ProcessesPage = () => {
  const state = useContext(AppState),
    { params, query, path } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    details_width = signal(localStorage.getItem("details_width") ?? 400),
    enable_history_mode = () => {
      route(`${path}?history=true`);
      state.history_mode.value = true;
    },
    disable_history_mode = () => {
      route(`${path}`);
      state.history_mode.value = false;
    },
    // condition naming for deciding on fetching data from backend
    definition_selected = params.definition_id,
    history_mode_disabled = !state.history_mode.value,
    no_definition_loaded = state.api.process.definition.one.value === null,
    /** @namespace state.api.process.definition.one.value.data **/
    loaded_definition_not_matching_url_param =
      state.api.process.definition.one.value?.status ===
        RESPONSE_STATE.SUCCESS &&
      state.api.process.definition.one.value?.data?.id !== params.definition_id,
    instance_selected = params.selection_id,
    activity_instances_signal = state.api.process.instance.activity_instances,
    no_activity_instances_loaded = activity_instances_signal.value === null,
    loaded_activity_instances_not_matching_url_param =
      activity_instances_signal.value?.status === RESPONSE_STATE.SUCCESS &&
      activity_instances_signal.value?.data?.id !== params.selection_id;

  if (query.history) {
    enable_history_mode();
  }

  /** @namespace details_width.value.data **/
  useEffect(() => {
    document.getElementById("selection").style.width = details_width.value.data;
  }, [details_width.value.data]);

  if (definition_selected) {
    if (history_mode_disabled) {
      if (no_definition_loaded) {
        void engine_rest.process_definition.one(state, params.definition_id);
        void engine_rest.process_definition.diagram(
          state,
          params.definition_id,
        );
        void engine_rest.process_definition.statistics(
          state,
          params.definition_id,
        );
      } else if (loaded_definition_not_matching_url_param) {
        void engine_rest.process_definition.one(state, params.definition_id);
        void engine_rest.process_definition.diagram(
          state,
          params.definition_id,
        );
        void engine_rest.process_definition.statistics(
          state,
          params.definition_id,
        );
      }
    } else if (no_definition_loaded) {
      void engine_rest.process_definition.one(state, params.definition_id);
      void engine_rest.process_definition.diagram(state, params.definition_id);
    } else if (loaded_definition_not_matching_url_param) {
      void engine_rest.process_definition.one(state, params.definition_id);
      void engine_rest.process_definition.diagram(state, params.definition_id);
    }
  } else if (state.api.process.definition.list.value === null) {
    void engine_rest.process_definition.list(state);
  }

  if (
    instance_selected &&
    history_mode_disabled &&
    (no_activity_instances_loaded ||
      loaded_activity_instances_not_matching_url_param)
  ) {
    void engine_rest.process_instance.activity_instances(
      state,
      params.selection_id,
    );
  }

  return (
    <main id="processes" class="split-layout">
      <div id="left-side">
        <div id="selection" onMouseUp={store_details_width}>
          {!params?.definition_id ? (
            <ProcessDefinitionSelection />
          ) : (
            <ProcessDefinitionDetails />
          )}
        </div>

        <div
          id="history-mode-indicator"
          class={state.history_mode.value ? "on" : "off"}
        >
          {state.history_mode.value ? (
            <button onClick={disable_history_mode}>
              {t("processes.history-mode-active")}
            </button>
          ) : (
            <button onClick={enable_history_mode}>
              {t("processes.enable-history-mode")}
            </button>
          )}
        </div>
      </div>
      <div id="canvas" />
      <ProcessDiagram />
    </main>
  );
};

const flatten_activity_instances = (node, out = []) => {
  if (!node) return out;
  const children = node.childActivityInstances ?? [];
  if (children.length === 0) {
    if (node.activityId && node.parentActivityInstanceId) out.push(node);
    return out;
  }
  children.forEach((c) => flatten_activity_instances(c, out));
  return out;
};

const activity_instances_to_tokens = (root) => {
  const leaves = flatten_activity_instances(root);
  const grouped = new Map();
  leaves.forEach((leaf) => {
    const existing = grouped.get(leaf.activityId);
    if (existing) {
      existing.activity_instance_ids.push(leaf.id);
      existing.instances += 1;
    } else {
      grouped.set(leaf.activityId, {
        id: leaf.activityId,
        instances: 1,
        incidents: [],
        activity_instance_ids: [leaf.id],
      });
    }
  });
  return Array.from(grouped.values());
};

const ProcessDiagram = () => {
  const state = useContext(AppState),
    {
      api: {
        process: {
          definition: { diagram, statistics },
          instance: { activity_instances },
        },
      },
    } = state,
    { params } = useRoute(),
    is_instance_view =
      params.selection_id !== undefined && !state.history_mode.value,
    has_xml =
      diagram.value?.data?.bpmn20Xml !== null &&
      diagram.value?.data?.bpmn20Xml !== undefined,
    show_diagram = params.definition_id !== undefined && has_xml,
    has_statistics =
      statistics.value !== null && statistics.value?.data !== undefined,
    has_activity_instances =
      activity_instances.value?.data !== undefined &&
      activity_instances.value?.data !== null,
    is_ready =
      state.history_mode.value ||
      (is_instance_view ? has_activity_instances : has_statistics),
    tokens = state.history_mode.value
      ? undefined
      : is_instance_view
        ? activity_instances_to_tokens(activity_instances.value?.data)
        : statistics.value?.data,
    mode = is_instance_view ? "instance" : "definition",
    instance_id = is_instance_view ? params.selection_id : undefined;

  /** @namespace diagram.value.data.bpmn20Xml **/
  return (
    <>
      {show_diagram && is_ready ? (
        <BPMNViewer
          xml={diagram.value.data?.bpmn20Xml}
          container="canvas"
          tokens={tokens}
          mode={mode}
          instance_id={instance_id}
        />
      ) : (
        <> </>
      )}
    </>
  );
};

const ProcessDefinitionSelection = () => {
  const {
      api: {
        process: { definition },
      },
    } = useContext(AppState),
    [t] = useTranslation();

  return (
    <div class="fade-in">
      <h1>{t("processes.title")}</h1>
      <table>
        <thead>
          <tr>
            <th>{t("common.name")}</th>
            <th>{t("processes.version")}</th>
            <th>{t("common.key")}</th>
            <th>{t("dashboard.instances")}</th>
            <th>{t("processes.tabs.incidents")}</th>
            <th>{t("common.state")}</th>
          </tr>
        </thead>
        <RequestState
          signal={definition.list}
          on_success={() => {
            const grouped_definitions = Object.groupBy(
              definition.list.value?.data,
              ({ definition }) => definition.key,
            );
            console.log(grouped_definitions);
            const grouped_definitions_values =
              Object.entries(grouped_definitions);
            console.log(grouped_definitions_values);

            return (
              <>
                {grouped_definitions_values.map(([key, definition_group]) => (
                  <tbody key={key}>
                    {definition_group.map((definition) => (
                      <ProcessDefinition key={definition.id} {...definition} />
                    ))}
                  </tbody>
                ))}
              </>
            );
          }}
        />
      </table>
    </div>
  );
};

const ProcessDefinitionDetails = () => {
  const {
      api: {
        process: {
          definition: { one: process_definition },
        },
      },
    } = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation();

  /** @namespace process_definition.value.data.tenantId **/
  return (
    <div class="fade-in">
      <div class="row gap-2">
        <a
          className="tabs-back"
          href={`/processes${keep_history_query(useRoute().query)}`}
          title={t("processes.change-definition")}
        >
          <Icons.arrow_left />
          <Icons.list />
        </a>
        <RequestState
          signal={process_definition}
          on_success={() => (
            <div>
              <h1>{process_definition.value?.data.name ?? " "}</h1>
              <dl>
                <dt>{t("processes.definition-id")}</dt>
                <dd
                  className="font-mono copy-on-click"
                  onClick={copyToClipboard}
                  title={t("processes.click-to-copy")}
                >
                  {process_definition.value?.data.id ?? "-/-"}
                </dd>
                {process_definition.value?.data.tenantId ? (
                  <>
                    <dt>{t("processes.tenant-id")}</dt>
                    <dd>{process_definition?.value.data.tenantId ?? "-/-"}</dd>
                  </>
                ) : (
                  <></>
                )}
              </dl>
            </div>
          )}
        />
      </div>

      <Accordion
        accordion_name="process_definition_details"
        sections={process_definition_tabs}
        base_path={`/processes/${params.definition_id}${keep_history_query(useRoute().query)}`}
      />
    </div>
  );
};

const ProcessDefinition = ({
  definition: { id, name, key, version },
  instances,
  incidents,
}) => (
  <tr>
    <td>
      <a
        href={`/processes/${id}/instances${keep_history_query(useRoute().query)}`}
      >
        {name}
      </a>
    </td>
    <td>{version}</td>
    <td>{key}</td>
    <td>{instances}</td>
    <td>{incidents.length}</td>
    <td>?</td>
  </tr>
);

const Instances = () => {
  const state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation();

  if (!params.selection_id) {
    if (!state.history_mode.value) {
      void engine_rest.history.process_instance.all_unfinished(
        state,
        params.definition_id,
      );
    } else {
      void engine_rest.history.process_instance.all(
        state,
        params.definition_id,
      );
    }
  }

  return !params?.selection_id ? (
    <table class="fade-in">
      <thead>
        <tr>
          <th>{t("common.id")}</th>
          <th>{t("processes.start-time")}</th>
          <th>{t("common.state")}</th>
          <th>{t("processes.business-key")}</th>
        </tr>
      </thead>
      <tbody>
        <InstanceTableRows />
      </tbody>
    </table>
  ) : (
    <InstanceDetails />
  );
};

const InstanceTableRows = () =>
  useContext(AppState).api.process.instance.list.value.data?.map((instance) => (
    <ProcessInstance key={instance.id} {...instance} />
  )) ?? <p>...</p>;

const InstanceDetails = () => {
  const state = useContext(AppState),
    {
      params: { selection_id, definition_id, panel },
    } = useRoute(),
    [t] = useTranslation();

  if (selection_id) {
    if (
      state.api.process.instance.one === undefined ||
      state.api.process.instance.one.value === null
    ) {
      if (!state.history_mode.value) {
        void engine_rest.process_instance.one(state, selection_id);
      } else {
        void engine_rest.history.process_instance.one(state, selection_id);
      }
    }
  }

  return (
    <div class="fade-in">
      <div class="row gap-2">
        <BackToListBtn
          url={`/processes/${definition_id}/instances${keep_history_query(useRoute().query)}`}
          title={t("processes.change-instance")}
          className="bg-1"
        />
        <InstanceDetailsDescription />
      </div>

      <Accordion
        sections={process_instance_tabs}
        accordion_name="instance_details_accordion"
        param_name="sub_panel"
        base_path={`/processes/${definition_id}/${panel}/${selection_id}${keep_history_query(useRoute().query)}`}
      />
    </div>
  );
};

const InstanceDetailsDescription = () => {
  const [t] = useTranslation();

  return (
    <dl>
      <dt>{t("processes.instance-id")}</dt>
      <dd>
        {useContext(AppState).api.process.instance.one.value.data?.id ?? "-/-"}
      </dd>
      <dt>{t("processes.business-key")}</dt>
      <dd>
        {useContext(AppState).api.process.instance.one.value.data
          ?.businessKey ?? "-/-"}
      </dd>
    </dl>
  );
};

const ProcessInstance = ({ id, startTime, state, businessKey }) => (
  <tr>
    <td class="font-mono">
      <a href={`./instances/${id}/vars${keep_history_query(useRoute().query)}`}>
        {" "}
        {id.substring(0, 8)}
      </a>
    </td>
    <td>{new Date(Date.parse(startTime)).toLocaleString()}</td>
    <td>{state}</td>
    <td>{businessKey}</td>
  </tr>
);

const InstanceVariables = () => {
  const state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation(),
    selection_exists =
      state.api.process.instance.variables.value !== null &&
      state.api.process.instance.variables.value.data !== null &&
      state.api.process.instance.variables.value.data !== undefined;

  // fixme: rm useSignalEffect
  useSignalEffect(() => {
    if (!state.history_mode.value) {
      void engine_rest.process_instance.variables(state, params.selection_id);
    } else {
      void engine_rest.history.variable_instance.by_process_instance(
        state,
        params.selection_id,
      );
    }
  });

  return (
    <table>
      <thead>
        <tr>
          <th>{t("common.name")}</th>
          <th>{t("common.type")}</th>
          <th>{t("common.value")}</th>
          <th>{t("common.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {selection_exists
          ? !state.history_mode.value
            ? Object.entries(
                state.api.process.instance.variables.value.data,
              ).map(
                // eslint-disable-next-line react/jsx-key
                ([name, { type, value }]) => (
                  <tr>
                    <td>{name}</td>
                    <td>{type}</td>
                    <td>{value}</td>
                  </tr>
                ),
              )
            : state.api.process.instance.variables.value.data.map(
                // eslint-disable-next-line react/jsx-key
                ({ name, type, value }) => (
                  <tr>
                    <td>{name}</td>
                    <td>{type}</td>
                    <td>{value}</td>
                  </tr>
                ),
              )
          : t("common.loading")}
      </tbody>
    </table>
  );
};

const InstanceIncidents = () => {
  const state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation();

  // fixme: rm useSignalEffect
  useSignalEffect(() => {
    void engine_rest.history.incident.by_process_instance(
      state,
      params.selection_id,
    );
  });

  /** @namespace state.api.history.incident.by_process_instance.value.data **/
  return (
    <table>
      <thead>
        <tr>
          <th>{t("processes.incidents.message")}</th>
          <th>{t("processes.incidents.process-instance")}</th>
          <th>{t("processes.incidents.timestamp")}</th>
          <th>{t("common.activity")}</th>
          <th>{t("processes.incidents.failing-activity")}</th>
          <th>{t("processes.incidents.cause-process-instance-id")}</th>
          <th>{t("processes.incidents.root-cause-process-instance-id")}</th>
          <th>{t("common.type")}</th>
          <th>{t("processes.incidents.annotation")}</th>
          <th>{t("common.action")}</th>
        </tr>
      </thead>
      <tbody>
        {state.api.history.incident.by_process_instance.value?.data?.map(
          // eslint-disable-next-line react/jsx-key
          ({
            id,
            incidentMessage,
            processInstanceId,
            createTime,
            activityId,
            failedActivityId,
            causeIncidentId,
            rootCauseIncidentId,
            incidentType,
            annotation,
          }) => (
            <tr key={id}>
              <td>{incidentMessage}</td>
              <td>
                <UUIDLink path={"/processes"} uuid={processInstanceId} />
              </td>
              <td>
                <time datetime={createTime}>
                  {createTime ? createTime.substring(0, 19) : "-/-"}
                </time>
              </td>
              <td>{activityId}</td>
              <td>{failedActivityId}</td>
              <td>
                <UUIDLink path={""} uuid={causeIncidentId} />
              </td>
              <td>
                <UUIDLink path={""} uuid={rootCauseIncidentId} />
              </td>
              <td>{incidentType}</td>
              <td>{annotation}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
};

const InstanceUserTasks = () => {
  const state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation();

  // fixme: rm useSignalEffect
  useSignalEffect(() => {
    // void engine_rest.task.by_process_instance(state, params.selection_id)
    void engine_rest.task.get_process_instance_tasks(
      state,
      params.selection_id,
    );
  });

  /** @namespace state.api.task.by_process_instance.value.data **/
  return (
    <table>
      <thead>
        <tr>
          <th>{t("common.activity")}</th>
          <th>{t("dashboard.assignee")}</th>
          <th>{t("processes.user-tasks.owner")}</th>
          <th>{t("dashboard.created")}</th>
          <th>{t("processes.user-tasks.due")}</th>
          <th>{t("processes.user-tasks.follow-up")}</th>
          <th>{t("tasks.task-list.table-headings.priority")}</th>
          <th>{t("processes.user-tasks.delegation-state")}</th>
          <th>{t("processes.user-tasks.task-id")}</th>
          <th>{t("common.action")}</th>
        </tr>
      </thead>
      <tbody>
        {state.api.task.by_process_instance.value?.data?.map(
          // eslint-disable-next-line react/jsx-key
          ({
            id,
            assignee,
            name,
            owner,
            created,
            due,
            followUp,
            priority,
            delegationState,
          }) => (
            <tr key={id}>
              <td>{name}</td>
              <td>{assignee}</td>
              <td>{owner}</td>
              <td>{created}</td>
              <td>{due}</td>
              <td>{followUp}</td>
              <td>{priority}</td>
              <td>{priority}</td>
              <td>{delegationState}</td>
              <td>
                <UUIDLink path="/" uuid={id} />
              </td>
              <td>
                <button>{t("processes.user-tasks.groups")}</button>
                <button>{t("processes.user-tasks.users")}</button>
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
};

const CalledProcessInstances = () => {
  const state = useContext(AppState),
    { selection_id, query } = useRoute(),
    [t] = useTranslation();

  // fixme: rm useSignalEffect
  useSignalEffect(
    () => void engine_rest.process_instance.called(state, selection_id),
  );

  /** @namespace state.api.process.instance.called.value.data **/
  /** @namespace instance.definitionId **/
  return (
    <table>
      <thead>
        <tr>
          <th>{t("common.state")}</th>
          <th>{t("processes.called-instances.called-process-instance")}</th>
          <th>{t("processes.called-instances.process-definition")}</th>
          <th>{t("common.activity")}</th>
        </tr>
      </thead>
      <tbody>
        {state.api.process.instance.called.value?.data?.map((instance) => (
          <tr key={instance.id}>
            <td>
              {instance.suspended ? t("common.suspended") : t("common.running")}
            </td>
            <td>
              <a href={`/processes/${instance.id}${keep_history_query(query)}`}>
                {instance.id}
              </a>
            </td>
            <td>{instance.definitionId}</td>
            <td>{instance.definitionId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Incidents = () => {
  const state = useContext(AppState),
    { definition_id } = useRoute(),
    [t] = useTranslation();

  // fixme: rm useSignalEffect
  useSignalEffect(
    () =>
      void engine_rest.history.incident.by_process_definition(
        state,
        definition_id,
      ),
  );

  /** @namespace instance.incidentMessage **/
  /** @namespace instance.incidentType **/
  return (
    <table>
      <thead>
        <tr>
          <th>{t("processes.incidents.message")}</th>
          <th>{t("common.type")}</th>
          <th>{t("processes.incidents.configuration")}</th>
        </tr>
      </thead>
      <tbody>
        {state.api.history.incident.by_process_definition.value?.data?.map(
          (incident) => (
            <tr key={incident.id}>
              <td>{incident.incidentMessage}</td>
              <td>{incident.incidentType}</td>
              <td>{incident.configuration}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
};

const CalledProcessDefinitions = () => {
  const state = useContext(AppState),
    { definition_id, query } = useRoute(),
    [t] = useTranslation();

  // fixme: rm useSignalEffect
  useSignalEffect(
    () => void engine_rest.process_definition.called(state, definition_id),
  );

  /** @namespace definition.calledFromActivityIds **/
  return (
    <table>
      <thead>
        <tr>
          <th>{t("processes.called-definitions.called-process-definition")}</th>
          <th>{t("common.state")}</th>
          <th>{t("common.activity")}</th>
        </tr>
      </thead>
      <tbody>
        {state.api.process.definition.called.value?.data?.map((definition) => (
          <tr key={definition.id}>
            <td>
              <a
                href={`/processes/${definition.id}${keep_history_query(query)}`}
              >
                {definition.name}
              </a>
            </td>
            <td>
              {definition.suspended
                ? t("common.suspended")
                : t("common.running")}
            </td>
            <td>{definition.calledFromActivityIds.map((a) => `${a}, `)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const JobDefinitions = () => {
  const state = useContext(AppState),
    { definition_id } = useRoute(),
    [t] = useTranslation();

  // fixme: rm useSignalEffect
  useSignalEffect(
    () =>
      void engine_rest.job_definition.all.by_process_definition(
        state,
        definition_id,
      ),
  );

  /** @namespace state.api.job_definition.all.by_process_definition.value.data **/
  /** @namespace definition.jobType **/
  /** @namespace definition.jobConfiguration **/
  /** @namespace definition.overridingJobPriority **/
  return (
    <div class="relative">
      <table>
        <thead>
          <tr>
            <th>{t("common.state")}</th>
            <th>{t("common.activity")}</th>
            <th>{t("common.type")}</th>
            <th>{t("processes.incidents.configuration")}</th>
            <th>{t("processes.jobs.overriding-job-priority")}</th>
            <th>{t("common.action")}</th>
          </tr>
        </thead>
        <tbody>
          {state.api.job_definition.all.by_process_definition.value?.data?.map(
            (definition) => (
              <tr key={definition.id}>
                <td>
                  {definition.suspended
                    ? t("common.suspended")
                    : t("common.active")}
                </td>
                <td>?</td>
                {/*<td>{definition.calledFromActivityIds.map(a => `${a}, `)}</td>*/}
                <td>{definition.jobType}</td>
                <td>{definition.jobConfiguration}</td>
                <td>{definition.overridingJobPriority ?? "-"}</td>
                <td>
                  <button>{t("processes.jobs.suspend")}</button>
                  <button>{t("processes.jobs.change-priority")}</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const BackToListBtn = ({ url, title, className }) => (
  <a className={`tabs-back ${className || ""}`} href={url} title={title}>
    <Icons.arrow_left />
    <Icons.list />
  </a>
);

const process_definition_tabs = [
  {
    nameKey: "processes.tabs.instances",
    id: "instances",
    pos: 0,
    target: <Instances />,
  },
  {
    nameKey: "processes.tabs.incidents",
    id: "incidents",
    pos: 1,
    target: <Incidents />,
  },
  {
    nameKey: "processes.tabs.called-definitions",
    id: "called_definitions",
    pos: 2,
    target: <CalledProcessDefinitions />,
  },
  {
    nameKey: "processes.tabs.jobs",
    id: "jobs",
    pos: 3,
    target: <JobDefinitions />,
  },
];

const UUIDLink = ({ uuid = "?", path }) => (
  <a href={`${path}${keep_history_query(useRoute().query)}`}>
    {uuid.substring(0, 8)}
  </a>
);

const process_instance_tabs = [
  {
    nameKey: "processes.tabs.variables",
    id: "vars",
    pos: 0,
    target: <InstanceVariables />,
  },
  {
    nameKey: "processes.tabs.instance-incidents",
    id: "instance_incidents",
    pos: 1,
    target: <InstanceIncidents />,
  },
  {
    nameKey: "processes.tabs.called-instances",
    id: "called_instances",
    pos: 2,
    target: <CalledProcessInstances />,
  },
  {
    nameKey: "processes.tabs.user-tasks",
    id: "user_tasks",
    pos: 3,
    target: <InstanceUserTasks />,
  },
  {
    nameKey: "processes.tabs.jobs",
    id: "jobs",
    pos: 4,
    // TODO: create Jobs example for old Camunda apps
    target: <p>Jobs</p>,
  },
  {
    nameKey: "processes.tabs.external-tasks",
    id: "external_tasks",
    pos: 5,
    // TODO: create External Apps example for old Camunda apps
    target: <p>External Tasks</p>,
  },
];

// fixme : extract to util file
const copyToClipboard = (event) =>
  navigator.clipboard.writeText(event.target.innerText);

export { ProcessesPage };
