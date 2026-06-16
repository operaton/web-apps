import { GET } from "../helper.jsx";

const compact_params = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

const report_url = (path, params = {}) => {
  const query = new URLSearchParams(compact_params(params)).toString();
  return `${path}${query ? `?${query}` : ""}`;
};

const get_process_instance_duration = (state, params = {}) =>
  GET(
    report_url("/history/process-instance/report", {
      reportType: "duration",
      periodUnit: "month",
      ...params,
    }),
    state,
    state.api.report.process_duration,
  );

const get_task_report = (state, params = {}) =>
  GET(
    report_url("/history/task/report", params),
    state,
    state.api.report.task,
  );

const report = {
  process_instance_duration: get_process_instance_duration,
  task: get_task_report,
};

export default report;
