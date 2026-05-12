import { useContext } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { useTranslation } from "react-i18next";
import { AppState } from "../state.js";

const PANELS = ["instances", "incidents", "called_definitions", "jobs"];

/**
 * The Processes page sub-navigation.
 *
 *   Definitions  ›  Instances (N)   Incidents (M)   Called Definitions   Jobs                [history toggle]
 *
 * The chevron after `Definitions` indicates that the rest are *children of
 * the selected definition*. They are dimmed (and unclickable) until a
 * definition is selected. The history-mode toggle is pinned to the right.
 */
export const ProcessSubNav = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    { params, query, path } = useRoute(),
    { route } = useLocation(),
    history_query = query.history ? "?history=true" : "",
    def_id = params.definition_id,
    has_def = !!def_id,
    active_panel = params.panel ?? (has_def ? "overview" : "definitions"),
    on_definitions = !has_def,
    instance_count =
      state.api.process.definition.statistics.value?.data?.reduce(
        (n, a) => n + (a.instances ?? 0),
        0,
      ),
    incident_count =
      state.api.process.definition.statistics.value?.data?.reduce(
        (n, a) => n + (a.incidents?.length ?? 0),
        0,
      ),
    history_active = state.history_mode.value;

  const child_item = (panel, label, count) => (
    <li key={panel}>
      {has_def ? (
        <a
          href={`/processes/${def_id}/${panel}${history_query}`}
          aria-current={active_panel === panel ? "page" : undefined}
        >
          {label}
          {count !== undefined && ` (${count})`}
        </a>
      ) : (
        <span class="disabled">{label}</span>
      )}
    </li>
  );

  return (
    <nav aria-label="Processes navigation">
      <menu>
        <li>
          <a
            href={`/processes${history_query}`}
            aria-current={on_definitions ? "page" : undefined}
          >
            {t("processes.subnav.definitions")}
          </a>
        </li>
        <li class="chevron" aria-hidden="true">
          ›
        </li>
        {child_item(
          "instances",
          t("processes.subnav.instances"),
          instance_count,
        )}
        {child_item(
          "incidents",
          t("processes.subnav.incidents"),
          incident_count,
        )}
        {child_item(
          "called_definitions",
          t("processes.subnav.called-definitions"),
        )}
        {child_item("jobs", t("processes.subnav.jobs"))}
      </menu>

      <button
        type="button"
        class={`history-toggle ${history_active ? "active" : ""}`}
        onClick={() => {
          const next = !history_active;
          state.history_mode.value = next;
          route(next ? `${path}?history=true` : path);
        }}
      >
        {history_active
          ? t("processes.history-mode-active")
          : t("processes.enable-history-mode")}
      </button>
    </nav>
  );
};

ProcessSubNav.PANELS = PANELS;
