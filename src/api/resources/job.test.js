import { describe, it, vi, beforeEach } from "vitest";

vi.mock("../helper.jsx", () => ({
  GET: vi.fn(),
}));

import { GET } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import job from "./job.js";

describe("api/resources/job", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
  });

  it("by_process_instance() GETs jobs for a process instance", () => {
    job.by_process_instance(state, "inst-1");
    expect_api_call(GET, {
      url: "/job?processInstanceId=inst-1",
      state,
      signal: state.api.job.by_process_instance,
    });
  });
});
