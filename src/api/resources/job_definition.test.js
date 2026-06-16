import { describe, it, vi, beforeEach } from "vitest";

vi.mock("../helper.jsx", () => ({
  GET: vi.fn(),
  PUT: vi.fn(),
}));

import { GET, PUT } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import job_definition from "./job_definition.js";

describe("api/resources/job_definition", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
  });

  it("all.by_process_definition() GETs job definitions for a process definition", () => {
    job_definition.all.by_process_definition(state, "def-1");
    expect_api_call(GET, {
      url: "/job-definition?processDefinitionId=def-1",
      state,
      signal: state.api.job_definition.all.by_process_definition,
    });
  });

  it("set_retries() PUTs retries to the job definition", () => {
    job_definition.set_retries(state, "job-def-1", 3);
    expect_api_call(PUT, {
      url: "/job-definition/job-def-1/retries",
      body: { retries: 3 },
      state,
      signal: state.api.job_definition.retries,
    });
  });

  it("set_retries() can include a due date", () => {
    job_definition.set_retries(
      state,
      "job-def-1",
      3,
      "2017-04-06T13:57:45.000+0200",
    );
    expect_api_call(PUT, {
      url: "/job-definition/job-def-1/retries",
      body: { retries: 3, dueDate: "2017-04-06T13:57:45.000+0200" },
      state,
      signal: state.api.job_definition.retries,
    });
  });
});
