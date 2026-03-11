import { useContext } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { AppState } from '../state.js'
import { useLocation, useRoute } from 'preact-iso'
import engine_rest, { RequestState } from '../api/engine_rest.jsx'
import { DmnViewer } from '../components/DMNViewer.jsx'
import { effect } from '@preact/signals'

const DecisionsPage = () => {
  const state = useContext(AppState),
    { api: { decision: { definitions, definition, dmn } } } = state,
    { params: { decision_id } } = useRoute()
  if (definitions.value === null) {
    void engine_rest.decision.get_decision_definitions(state)
  }

  if (decision_id && definition.value === null) {
    void engine_rest.decision.get_decision_definition(state, decision_id)
  }

  if (decision_id && dmn.value === null) {
    void engine_rest.decision.get_dmn_xml(state, decision_id)
  }

  return (
    <div class="fade-in list-container">
      <h2 class="screen-hidden"><DecisionsTitle /></h2>
      <DecisionsList />
      <DecisionDetails />
    </div>
  )
}

const DecisionsTitle = () => {
  const [t] = useTranslation()
  return t("decisions.title")
}

const DecisionsList = () => {
  const
    state = useContext(AppState),
    { api: { decision: { definition, dmn } } } = state,
    { params } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    reset_state = (decision_id) => {
      route(`/decisions/${decision_id}`)
      definition.value = null
      dmn.value = null
    }

  return (
    <div class="list-wrapper">
      <h3 class="screen-hidden">{t("decisions.queried-decisions")}</h3>
      <ul class="list">
        {state.api.decision.definitions.value?.data?.map((decision) => (
          <li
            key={decision.id}
            class={params.decision_id === decision.id ? 'selected' : null}
          >
            <a href={`/decisions/${decision.id}`} onClick={() => reset_state(decision.id)}>
              <div class="title">
                {decision?.name || decision?.id}
              </div>
            </a>
          </li>
        )) ?? t("common.loading")}
      </ul>
    </div>
  )
}

const DecisionDetails = () => {
  const state = useContext(AppState),
    { api: { decision: { definition, dmn } } } = state,
    { params: { decision_id } } = useRoute(),
    [t] = useTranslation()

  return <div class="p-2">
    <RequestState
      signal={definition}
      on_nothing={() => <p class="info-box">{t("decisions.select-details")}</p>}
      on_success={() => {
        const {
          id, key, name, version, versionTag, tenantId, deploymentId,
          decisionRequirementsDefinitionId, historyTimeToLive,
          resource
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
  </div>
}

export { DecisionsPage }
