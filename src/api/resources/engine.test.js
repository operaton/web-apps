import { describe, it, vi, beforeEach } from "vitest";

vi.mock("../helper.jsx", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
}));

import { GET, POST } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import engine from "./engine.js";

describe("api/resources/engine", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
  });

  it("telemetry() GETs the default engine telemetry data", () => {
    engine.telemetry(state);
    expect_api_call(GET, {
      url: "/engine/default/telemetry/data",
      state,
      signal: state.api.engine.telemetry,
    });
  });

  it("telemetry_configuration() GETs the telemetry configuration", () => {
    engine.telemetry_configuration(state);
    expect_api_call(GET, {
      url: "/telemetry/configuration",
      state,
      signal: state.api.engine.telemetry_configuration,
    });
  });

  it("configure_telemetry() POSTs the telemetry configuration", () => {
    engine.configure_telemetry(state, false);
    expect_api_call(POST, {
      url: "/telemetry/configuration",
      body: { enableTelemetry: false },
      state,
      signal: state.api.engine.telemetry_configuration_update,
    });
  });
});
