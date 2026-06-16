import { useContext, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { AppState } from '../state.js'
import { useLocation, useRoute } from 'preact-iso'
import engine_rest, { RequestState } from '../api/engine_rest.jsx'
import { DmnViewer } from '../components/DMNViewer.jsx'
import { ListFilter } from '../components/ListFilter.jsx'
import { ManageFilters } from '../components/ManageFilters.jsx'
import {
  filter_share_link,
  parse_list_query,
  with_manage,
  without_manage,
  write_list_query,
} from '../helper/list_query.js'
import {
  create_saved_filter,
  delete_saved_filter,
  hydrate_signal,
  update_saved_filter,
} from '../helper/saved_filters.js'

const RESOURCE_TYPE = 'decision_definition'

const SORT_OPTIONS = [
  { key: 'name', nameKey: 'decisions.sort.name' },
  { key: 'key', nameKey: 'decisions.sort.key' },
  { key: 'category', nameKey: 'decisions.sort.category' },
  { key: 'id', nameKey: 'decisions.sort.id' },
  { key: 'version', nameKey: 'decisions.sort.version' },
  { key: 'deploymentId', nameKey: 'decisions.sort.deploymentId' },
  { key: 'tenantId', nameKey: 'decisions.sort.tenantId' },
]

const FILTER_KEYS = [
  { key: 'name', nameKey: 'decisions.filter_keys.name', type: 'string' },
  { key: 'nameLike', nameKey: 'decisions.filter_keys.nameLike', type: 'string' },
  { key: 'key', nameKey: 'decisions.filter_keys.key', type: 'string' },
  { key: 'keyLike', nameKey: 'decisions.filter_keys.keyLike', type: 'string' },
  { key: 'category', nameKey: 'decisions.filter_keys.category', type: 'string' },
  { key: 'categoryLike', nameKey: 'decisions.filter_keys.categoryLike', type: 'string' },
  { key: 'versionTag', nameKey: 'decisions.filter_keys.versionTag', type: 'string' },
  { key: 'latestVersion', nameKey: 'decisions.filter_keys.latestVersion', type: 'boolean' },
  { key: 'decisionRequirementsDefinitionKey', nameKey: 'decisions.filter_keys.decisionRequirementsDefinitionKey', type: 'string' },
]

const find_saved = (signal, id) => {
  if (!id || id === 'all') return null
  return (signal.value?.data ?? []).find((f) => f.id === id) ?? null
}

const load_decisions = (state, query) => {
  const { saved_filter_id, sortBy, sortOrder, criteria } = parse_list_query(query)
  const saved = find_saved(state.api.decision.saved_filters, saved_filter_id)
  const params = {
    ...(saved?.query ?? {}),
    ...criteria,
    ...(sortBy ? { sortBy } : {}),
    ...(sortOrder ? { sortOrder } : {}),
  }
  void engine_rest.decision.get_decision_definitions(state, params)
}

const load_decision_instances = (state, decision_id, firstResult = 0) => {
  if (!decision_id) return
  void engine_rest.history.decision_instance.by_decision_definition(
    state,
    decision_id,
    firstResult,
  )
}

const DecisionsPage = () => {
  const state = useContext(AppState),
    { api: { decision: { definition, dmn }, history: { decision_instance } } } = state,
    { params: { decision_id }, query } = useRoute()

  useEffect(() => {
    hydrate_signal(RESOURCE_TYPE, state.api.decision.saved_filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load_decisions(state, query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)])

  useEffect(() => {
    if (decision_id) {
      void engine_rest.decision.get_decision_definition(state, decision_id)
      void engine_rest.decision.get_dmn_xml(state, decision_id)
      load_decision_instances(state, decision_id)
    }
    // Clear stale per-decision data so navigating between decisions doesn't
    // render the previous decision's metadata, DMN diagram or instances briefly.
    return () => {
      definition.value = null
      dmn.value = null
      decision_instance.list.value = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision_id])

  return (
    <main id="content" class="decisions fade-in">
      <DecisionsList />
      <DecisionDetails />
    </main>
  )
}

const DecisionsList = () => {
  const
    state = useContext(AppState),
    { api: { decision: { definitions, saved_filters } } } = state,
    { params, query } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation()

  const parsed = parse_list_query(query)
  const list_current = {
    saved_filter_id: parsed.saved_filter_id,
    sortBy: parsed.sortBy ?? 'name',
    sortOrder: parsed.sortOrder ?? 'asc',
    criteria: parsed.criteria,
  }

  const apply_patch = (patch) => {
    route(write_list_query(window.location.href, patch), true)
  }
  const open_manage = () => route(with_manage(), false)

  if (query?.filters === 'manage') return <DecisionsManage />

  return (
    <div id="decision-list">
      <h2 class="screen-hidden">{t("decisions.queried-decisions")}</h2>
      <ListFilter
        sort_options={SORT_OPTIONS}
        saved_filters_signal={saved_filters}
        current={list_current}
        defaults={{ sortBy: 'name', sortOrder: 'asc' }}
        on_change={apply_patch}
        on_manage={open_manage}
      />
      <RequestState
        signal={definitions}
        on_success={() =>
          <table>
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("common.key")}</th>
                <th>{t("processes.version")}</th>
                <th>{t("decisions.version-tag")}</th>
                <th>{t("decisions.history-ttl")}</th>
              </tr>
            </thead>
            <tbody>
              {definitions.value?.data?.map((decision) => (
                <tr
                  key={decision.id}
                  class={params.decision_id === decision.id ? 'selected' : null}
                >
                  <td><a href={`/decisions/${decision.id}`}>
                    {decision?.name || decision?.id}
                  </a></td>
                  <td>{decision.key}</td>
                  <td>{decision.version}</td>
                  <td>{decision.versionTag}</td>
                  <td>{decision.historyTimeToLive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />
    </div>
  )
}

const DecisionDetails = () => {
  const state = useContext(AppState),
    { api: { decision: { definition, dmn } } } = state,
    { params: { decision_id } } = useRoute(),
    [t] = useTranslation()

  return <div id="decision-details">
    <RequestState
      signal={definition}
      on_nothing={() => <p class="info-box">{t("decisions.select-details")}</p>}
      on_success={() => {
        const {
          id, key, name, version, versionTag, tenantId, deploymentId,
          decisionRequirementsDefinitionId, historyTimeToLive,
        } = definition.value.data

        return <div>
          <h3>{t("decisions.definition-details")}</h3>
          <dl>
            <dt>{t("common.id")}</dt>
            <dd>{id}</dd>
            <dt>{t("processes.version")}</dt>
            <dd>{version}</dd>
            <dt>{t("decisions.version-tag")}</dt>
            <dd>{versionTag}</dd>
            <dt>{t("common.key")}</dt>
            <dd>{key}</dd>
            <dt>{t("common.name")}</dt>
            <dd>{name}</dd>
            <dt>{t("processes.tenant-id")}</dt>
            <dd>{tenantId}</dd>
            <dt>{t("decisions.deployment-id")}</dt>
            <dd>{deploymentId}</dd>
            <dt>{t("decisions.decision-requirements-id")}</dt>
            <dd>{decisionRequirementsDefinitionId}</dd>
            <dt>{t("decisions.history-ttl")}</dt>
            <dd>{historyTimeToLive}</dd>
          </dl>
        </div>
      }} />


    <div id="diagram-container" />

    <RequestState
      signal={dmn}
      on_nothing={() => <p class="info-box">{t("decisions.select-diagram")}</p>}
      on_success={() => <DmnViewer xml={dmn.value.data.dmnXml} container="#diagram-container" />} />

    {decision_id ? <DecisionInstances decision_id={decision_id} /> : null}
  </div>
}

const DecisionInstances = ({ decision_id }) => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    list = state.api.history.decision_instance.list

  const load_more = () =>
    load_decision_instances(state, decision_id, list.value?.data?.length ?? 0)

  const process_instance_link = (instance) =>
    instance.processDefinitionId && instance.processInstanceId
      ? `/processes/${instance.processDefinitionId}/instances/${instance.processInstanceId}/vars?history=true`
      : null

  const formatted_time = (value) =>
    value ? new Date(Date.parse(value)).toLocaleString() : '—'

  return (
    <section id="decision-instances">
      <header>
        <h3>{t("decisions.instances.title")}</h3>
        <button
          type="button"
          class="secondary"
          onClick={() => load_decision_instances(state, decision_id)}
        >
          {t("decisions.instances.refresh")}
        </button>
      </header>
      <RequestState
        signal={list}
        on_success={() => {
          const rows = list.value?.data ?? []
          if (rows.length === 0) {
            return <p class="info-box">{t("decisions.instances.empty")}</p>
          }
          return (
            <>
              <table>
                <thead>
                  <tr>
                    <th>{t("decisions.instances.id")}</th>
                    <th>{t("decisions.instances.evaluation-time")}</th>
                    <th>{t("decisions.instances.process-instance")}</th>
                    <th>{t("decisions.instances.activity")}</th>
                    <th>{t("processes.tenant-id")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((instance) => {
                    const process_link = process_instance_link(instance)
                    return (
                      <tr key={instance.id}>
                        <td class="font-mono">{instance.id?.substring(0, 8)}</td>
                        <td>
                          <time datetime={instance.evaluationTime}>
                            {formatted_time(instance.evaluationTime)}
                          </time>
                        </td>
                        <td class="font-mono">
                          {process_link ? (
                            <a href={process_link}>
                              {instance.processInstanceId.substring(0, 8)}
                            </a>
                          ) : (
                            instance.processInstanceId ?? '—'
                          )}
                        </td>
                        <td>{instance.activityId ?? '—'}</td>
                        <td>{instance.tenantId ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {list.value?.hasMore === true ? (
                <button class="load-more" onClick={load_more}>
                  {t("tasks.load-more")}
                </button>
              ) : list.value?.hasMore === false ? (
                <small class="load-more-end">{t("tasks.no-more-items")}</small>
              ) : null}
            </>
          )
        }}
      />
    </section>
  )
}

const DecisionsManage = () => {
  const state = useContext(AppState),
    { route } = useLocation(),
    [t] = useTranslation()

  const refresh = () =>
    hydrate_signal(RESOURCE_TYPE, state.api.decision.saved_filters)
  return (
    <div id="decision-list" class="fade-in">
      <ManageFilters
        title={t('decisions.filter.manage_title')}
        saved_filters_signal={state.api.decision.saved_filters}
        filter_keys={FILTER_KEYS}
        sort_options={SORT_OPTIONS}
        on_save={(f) => { create_saved_filter(RESOURCE_TYPE, f); refresh() }}
        on_update={(id, f) => { update_saved_filter(RESOURCE_TYPE, id, f); refresh() }}
        on_delete={(id) => { delete_saved_filter(RESOURCE_TYPE, id); refresh() }}
        on_close={() => route(without_manage(), true)}
        build_share_link={(f) => filter_share_link(window.location.href, f)}
      />
    </div>
  )
}

export { DecisionsPage }
