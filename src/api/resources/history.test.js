import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../helper.jsx", () => ({
  GET: vi.fn(),
  PAGINATED_GET: vi.fn(),
  PUT: vi.fn(),
}));

import { GET, PAGINATED_GET, PUT } from "../helper.jsx";
import { create_mock_state, expect_api_call } from "../../test/helpers.js";
import history from "./history.js";

describe("api/resources/history", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
  });

  it("process_instance.all() PAGINATED_GETs the instance list", () => {
    history.process_instance.all(state, "def-1", {}, 40);
    expect_api_call(PAGINATED_GET, {
      url: "/history/process-instance?sortBy=startTime&sortOrder=asc&processDefinitionId=def-1",
      state,
      signal: state.api.process.instance.list,
    });
    expect(PAGINATED_GET.mock.lastCall[3]).toBe(40);
    expect(PAGINATED_GET.mock.lastCall[4]).toBe(20);
  });

  it("process_instance.all() defaults firstResult to 0", () => {
    history.process_instance.all(state, "def-1");
    expect(PAGINATED_GET.mock.lastCall[3]).toBe(0);
    expect(PAGINATED_GET.mock.lastCall[4]).toBe(20);
  });

  it("process_instance.all() forwards extra filter params and lets them override defaults", () => {
    history.process_instance.all(
      state,
      "def-1",
      { businessKeyLike: "%foo%", sortBy: "businessKey", sortOrder: "desc" },
    );
    expect_api_call(PAGINATED_GET, {
      url: "/history/process-instance?sortBy=businessKey&sortOrder=desc&processDefinitionId=def-1&businessKeyLike=%25foo%25",
      state,
      signal: state.api.process.instance.list,
    });
  });

  it("process_instance.one() GETs a single instance", () => {
    history.process_instance.one(state, "inst-1");
    expect_api_call(GET, {
      url: "/history/process-instance/inst-1",
      state,
      signal: state.api.process.instance.one,
    });
  });

  it("process_instance.all_unfinished() PAGINATED_GETs with unfinished=true", () => {
    history.process_instance.all_unfinished(state, "def-1", {}, 60);
    expect_api_call(PAGINATED_GET, {
      url: "/history/process-instance?sortBy=startTime&sortOrder=asc&unfinished=true&processDefinitionId=def-1",
      state,
      signal: state.api.process.instance.list,
    });
    expect(PAGINATED_GET.mock.lastCall[3]).toBe(60);
    expect(PAGINATED_GET.mock.lastCall[4]).toBe(20);
  });

  it("incident.by_process_definition() GETs incidents filtered by definition", () => {
    history.incident.by_process_definition(state, "def-1");
    expect_api_call(GET, {
      url: "/history/incident?processDefinitionId=def-1",
      state,
      signal: state.api.history.incident.by_process_definition,
    });
  });

  it("incident.by_process_instance() GETs incidents filtered by instance", () => {
    history.incident.by_process_instance(state, "inst-1");
    expect_api_call(GET, {
      url: "/history/incident?processInstanceId=inst-1",
      state,
      signal: state.api.history.incident.by_process_instance,
    });
  });

  it("variable_instance.by_process_instance() GETs variables filtered by instance", () => {
    history.variable_instance.by_process_instance(state, "inst-1");
    expect_api_call(GET, {
      url: "/history/variable-instance?processInstanceId=inst-1",
      state,
      signal: state.api.process.instance.variables,
    });
  });

  it("get_user_operation() GETs user operations filtered by instance", () => {
    history.get_user_operation(state, "inst-1");
    expect_api_call(GET, {
      url: "/history/user-operation?processInstanceId=inst-1",
      state,
      signal: state.api.history.user_operation,
    });
  });

  it("operation_log.all() PAGINATED_GETs the global operation log", () => {
    history.operation_log.all(
      state,
      { userId: "demo", operationType: "ModifyProcessInstance" },
      30,
    );
    expect_api_call(PAGINATED_GET, {
      url: "/history/user-operation?sortBy=timestamp&sortOrder=desc&userId=demo&operationType=ModifyProcessInstance",
      state,
      signal: state.api.history.operation_log.list,
    });
    expect(PAGINATED_GET.mock.lastCall[3]).toBe(30);
    expect(PAGINATED_GET.mock.lastCall[4]).toBe(30);
  });

  it("operation_log.count() GETs the matching operation count", () => {
    history.operation_log.count(state, {
      timestampAfter: "2026-06-01T00:00:00.000+0000",
    });
    expect_api_call(GET, {
      url: "/history/user-operation/count?sortBy=timestamp&sortOrder=desc&timestampAfter=2026-06-01T00%3A00%3A00.000%2B0000",
      state,
      signal: state.api.history.operation_log.count,
    });
  });

  it("operation_log.set_annotation() PUTs the annotation body", () => {
    history.operation_log.set_annotation(state, "op1", "Reviewed");
    expect_api_call(PUT, {
      url: "/history/user-operation/op1/set-annotation",
      body: { annotation: "Reviewed" },
      state,
      signal: state.api.history.operation_log.update,
    });
  });

  it("operation_log.clear_annotation() PUTs to the clear endpoint", () => {
    history.operation_log.clear_annotation(state, "op1");
    expect_api_call(PUT, {
      url: "/history/user-operation/op1/clear-annotation",
      body: {},
      state,
      signal: state.api.history.operation_log.update,
    });
  });

  it("task.by_process_instance() GETs historic tasks filtered by instance", () => {
    history.task.by_process_instance(state, "inst-1");
    expect_api_call(GET, {
      url: "/history/task?processInstanceId=inst-1",
      state,
      signal: state.api.history.task.by_process_instance,
    });
  });

  it("process_instance.called() GETs historic child instances of an instance", () => {
    history.process_instance.called(state, "inst-1");
    expect_api_call(GET, {
      url: "/history/process-instance?superProcessInstanceId=inst-1",
      state,
      signal: state.api.history.process_instance.called,
    });
  });
});
