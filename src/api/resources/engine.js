import { GET, POST } from '../helper.jsx'

export const get_telemetry_data = (state) =>
  GET('/engine/default/telemetry/data', state, state.api.engine.telemetry)

export const get_telemetry_configuration = (state) =>
  GET('/telemetry/configuration', state, state.api.engine.telemetry_configuration)

export const configure_telemetry = (state, enableTelemetry) =>
  POST('/telemetry/configuration', { enableTelemetry }, state, state.api.engine.telemetry_configuration_update)

const engine =
  {
    telemetry: get_telemetry_data,
    telemetry_configuration: get_telemetry_configuration,
    configure_telemetry,
  }

export default engine
