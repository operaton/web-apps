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

  it("set_priority() PUTs overriding priority to the job definition", () => {
    job_definition.set_priority(state, "job-def-1", 42, true);
    expect_api_call(PUT, {
      url: "/job-definition/job-def-1/jobPriority",
      body: { priority: 42, includeJobs: true },
      state,
      signal: state.api.job_definition.priority,
    });
  });

  it("set_priority() resets priority without propagating to existing jobs", () => {
    job_definition.set_priority(state, "job-def-1", null, true);
    expect_api_call(PUT, {
      url: "/job-definition/job-def-1/jobPriority",
      body: { priority: null, includeJobs: false },
      state,
      signal: state.api.job_definition.priority,
    });
  });
});
