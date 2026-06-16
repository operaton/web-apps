import { describe, it, vi, beforeEach } from "vitest";

vi.mock("../helper.jsx", () => ({
  GET: vi.fn(),
}));

import { GET } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import external_task from "./external_task.js";

describe("api/resources/external_task", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
  });

  it("by_process_instance() GETs external tasks for a process instance", () => {
    external_task.by_process_instance(state, "inst-1");
    expect_api_call(GET, {
      url: "/external-task?processInstanceId=inst-1",
      state,
      signal: state.api.external_task.by_process_instance,
    });
  });
});
