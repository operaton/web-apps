import { GET } from '../helper.jsx'


const get_decision_definition = (state, id) =>
  GET(`/decision-definition/${id}`, state, state.api.decision.definition)

const get_decision_definitions = (state, params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return GET(`/decision-definition${qs ? `?${qs}` : ''}`, state, state.api.decision.definitions)
}


const get_dmn_xml = (state, id) =>
  GET(`/decision-definition/${id}/xml`, state, state.api.decision.dmn)

const get_decision_requirements_xml = (state, id) =>
  GET(`/decision-requirements-definition/${id}/xml`, state, state.api.decision.drd)


const decision = {
  get_decision_definition,
  get_decision_definitions,
  get_dmn_xml,
  get_decision_requirements_xml,
}

export default decision
