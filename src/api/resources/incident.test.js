import { describe, it, vi, beforeEach } from "vitest";

vi.mock("../helper.jsx", () => ({
  DELETE: vi.fn(),
  GET: vi.fn(),
  PUT: vi.fn(),
}));

import { DELETE, GET, PUT } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import incident from "./incident.js";

describe("api/resources/incident", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
  });

  it("by_process_definition() GETs runtime incidents filtered by definition", () => {
    incident.by_process_definition(state, "def-1");
    expect_api_call(GET, {
      url: "/incident?processDefinitionId=def-1",
      state,
      signal: state.api.incident.by_process_definition,
    });
  });

  it("by_process_instance() GETs runtime incidents filtered by instance", () => {
    incident.by_process_instance(state, "inst-1");
    expect_api_call(GET, {
      url: "/incident?processInstanceId=inst-1",
      state,
      signal: state.api.incident.by_process_instance,
    });
  });

  it("set_annotation() PUTs the annotation body", () => {
    incident.set_annotation(state, "inc-1", "Checked by ops");
    expect_api_call(PUT, {
      url: "/incident/inc-1/annotation",
      body: { annotation: "Checked by ops" },
      state,
      signal: state.api.incident.annotation,
    });
  });

  it("clear_annotation() DELETEs the annotation", () => {
    incident.clear_annotation(state, "inc-1");
    expect_api_call(DELETE, {
      url: "/incident/inc-1/annotation",
      body: null,
      state,
      signal: state.api.incident.annotation,
    });
  });
});
