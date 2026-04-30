import { useContext } from 'preact/hooks'
import { useRoute } from 'preact-iso'
import { useTranslation } from 'react-i18next'
import { AppState } from '../state.js'

const PANELS = ['instances', 'incidents', 'called_definitions', 'jobs']

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
    { params, query } = useRoute(),
    history_query = query.history ? '?history=true' : '',
    def_id = params.definition_id,
    has_def = !!def_id,
    active_panel = params.panel ?? (has_def ? 'overview' : 'definitions'),
    on_definitions = !has_def,
    instance_count = state.api.process.definition.statistics.value?.data?.reduce(
      (n, a) => n + (a.instances ?? 0),
      0,
    ),
    incident_count = state.api.process.definition.statistics.value?.data?.reduce(
      (n, a) => n + (a.incidents?.length ?? 0),
      0,
    ),
    history_active = state.history_mode.value

  const child_link = (panel, label, count) => {
    if (!has_def) {
      return (
        <span class="processes-subnav-link disabled">
          {label}{count !== undefined && ` (${count})`}
        </span>
      )
    }
    return (
      <a
        href={`/processes/${def_id}/${panel}${history_query}`}
        class={`processes-subnav-link ${active_panel === panel ? 'active' : ''}`}
      >
        {label}{count !== undefined && ` (${count})`}
      </a>
    )
  }

  return (
    <nav class="processes-subnav" aria-label="Processes navigation">
      <div class="processes-subnav-trail">
        <a
          href={`/processes${history_query}`}
          class={`processes-subnav-link ${on_definitions ? 'active' : ''}`}
        >
          {t('processes.subnav.definitions')}
        </a>
        <span class="processes-subnav-chevron" aria-hidden="true">›</span>
        {child_link('instances', t('processes.subnav.instances'), instance_count)}
        {child_link('incidents', t('processes.subnav.incidents'), incident_count)}
        {child_link('called_definitions', t('processes.subnav.called-definitions'))}
        {child_link('jobs', t('processes.subnav.jobs'))}
      </div>

      <button
        type="button"
        class={`processes-subnav-history ${history_active ? 'active' : ''}`}
        onClick={() => (state.history_mode.value = !history_active)}
      >
        {history_active
          ? t('processes.history-mode-active')
          : t('processes.enable-history-mode')}
      </button>
    </nav>
  )
}

ProcessSubNav.PANELS = PANELS
