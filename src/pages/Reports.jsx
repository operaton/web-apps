import { useSignal } from "@preact/signals";
import { useContext, useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";
import engine_rest, { RequestState } from "../api/engine_rest.jsx";
import { AppState } from "../state.js";

const today = () => new Date().toISOString().slice(0, 10);

const start_of_year = () => {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
};

const date_param = (value, end = false) =>
  value ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}+0000` : null;

const process_report_params = (form) => ({
  periodUnit: form.period_unit.value,
  processDefinitionKeyIn: form.process_definition_keys.value,
  startedAfter: date_param(form.started_after.value),
  startedBefore: date_param(form.started_before.value, true),
});

const task_report_params = (form) => ({
  reportType: form.report_type.value,
  periodUnit:
    form.report_type.value === "duration" ? form.period_unit.value : null,
  groupBy: form.report_type.value === "count" ? form.group_by.value : null,
  completedAfter: date_param(form.completed_after.value),
  completedBefore: date_param(form.completed_before.value, true),
});

const load_reports = (state, process_form, task_form) => {
  void engine_rest.report.process_instance_duration(
    state,
    process_report_params(process_form),
  );
  void engine_rest.report.task(state, task_report_params(task_form));
};

const num = (value) => (value ?? 0).toLocaleString();

const format_duration = (value) => {
  if (value === null || value === undefined) return "-";
  const total_seconds = Math.round(Number(value) / 1000),
    days = Math.floor(total_seconds / 86400),
    hours = Math.floor((total_seconds % 86400) / 3600),
    minutes = Math.floor((total_seconds % 3600) / 60),
    seconds = total_seconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const csv_escape = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const download_text = (filename, type, content) => {
  const url = URL.createObjectURL(new Blob([content], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const export_json = (filename, rows) =>
  download_text(
    filename,
    "application/json",
    JSON.stringify(rows ?? [], null, 2),
  );

const export_csv = (filename, rows, columns) => {
  const csv = [
    columns.map(({ label }) => csv_escape(label)).join(","),
    ...(rows ?? []).map((row) =>
      columns.map(({ value }) => csv_escape(value(row))).join(","),
    ),
  ].join("\n");
  download_text(filename, "text/csv", csv);
};

const ReportsPage = () => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    process_form = {
      period_unit: useSignal("month"),
      process_definition_keys: useSignal(""),
      started_after: useSignal(start_of_year()),
      started_before: useSignal(today()),
    },
    task_form = {
      report_type: useSignal("count"),
      period_unit: useSignal("month"),
      group_by: useSignal("processDefinition"),
      completed_after: useSignal(start_of_year()),
      completed_before: useSignal(today()),
    };

  useEffect(() => {
    load_reports(state, process_form, task_form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main id="content" class="reports fade-in">
      <header>
        <div>
          <h1>{t("reports.title")}</h1>
          <p>{t("reports.subtitle")}</p>
        </div>
        <button
          type="button"
          class="secondary"
          onClick={() => load_reports(state, process_form, task_form)}
        >
          {t("reports.refresh")}
        </button>
      </header>

      <ProcessDurationReport form={process_form} />
      <TaskReport form={task_form} />
    </main>
  );
};

const ProcessDurationReport = ({ form }) => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    signal = state.api.report.process_duration,
    run = (event) => {
      event.preventDefault();
      void engine_rest.report.process_instance_duration(
        state,
        process_report_params(form),
      );
    };

  return (
    <section>
      <header>
        <h2>{t("reports.process.title")}</h2>
        <ExportButtons
          filename="process-instance-duration"
          signal={signal}
          columns={duration_columns(t)}
        />
      </header>
      <form class="reports-filter" onSubmit={run}>
        <label>
          {t("reports.process.period")}
          <select
            value={form.period_unit.value}
            onChange={(event) =>
              (form.period_unit.value = event.currentTarget.value)
            }
          >
            <option value="month">{t("reports.period.month")}</option>
            <option value="quarter">{t("reports.period.quarter")}</option>
          </select>
        </label>
        <label>
          {t("reports.process.keys")}
          <input
            type="text"
            value={form.process_definition_keys.value}
            onInput={(event) =>
              (form.process_definition_keys.value =
                event.currentTarget.value)
            }
          />
        </label>
        <label>
          {t("reports.started-after")}
          <input
            type="date"
            value={form.started_after.value}
            onInput={(event) =>
              (form.started_after.value = event.currentTarget.value)
            }
          />
        </label>
        <label>
          {t("reports.started-before")}
          <input
            type="date"
            value={form.started_before.value}
            onInput={(event) =>
              (form.started_before.value = event.currentTarget.value)
            }
          />
        </label>
        <button type="submit">{t("reports.run")}</button>
      </form>
      <RequestState
        signal={signal}
        on_success={() => <DurationTable rows={signal.value.data ?? []} />}
      />
    </section>
  );
};

const TaskReport = ({ form }) => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    signal = state.api.report.task,
    run = (event) => {
      event.preventDefault();
      void engine_rest.report.task(state, task_report_params(form));
    };

  return (
    <section>
      <header>
        <h2>{t("reports.task.title")}</h2>
        <ExportButtons
          filename="historic-task-report"
          signal={signal}
          columns={
            form.report_type.value === "duration"
              ? duration_columns(t)
              : task_count_columns(t)
          }
        />
      </header>
      <form class="reports-filter" onSubmit={run}>
        <label>
          {t("reports.task.type")}
          <select
            value={form.report_type.value}
            onChange={(event) =>
              (form.report_type.value = event.currentTarget.value)
            }
          >
            <option value="count">{t("reports.task.count")}</option>
            <option value="duration">{t("reports.task.duration")}</option>
          </select>
        </label>
        {form.report_type.value === "duration" ? (
          <label>
            {t("reports.task.period")}
            <select
              value={form.period_unit.value}
              onChange={(event) =>
                (form.period_unit.value = event.currentTarget.value)
              }
            >
              <option value="month">{t("reports.period.month")}</option>
              <option value="quarter">{t("reports.period.quarter")}</option>
            </select>
          </label>
        ) : (
          <label>
            {t("reports.task.group-by")}
            <select
              value={form.group_by.value}
              onChange={(event) =>
                (form.group_by.value = event.currentTarget.value)
              }
            >
              <option value="processDefinition">
                {t("reports.task.process-definition")}
              </option>
              <option value="taskName">{t("reports.task.task-name")}</option>
            </select>
          </label>
        )}
        <label>
          {t("reports.completed-after")}
          <input
            type="date"
            value={form.completed_after.value}
            onInput={(event) =>
              (form.completed_after.value = event.currentTarget.value)
            }
          />
        </label>
        <label>
          {t("reports.completed-before")}
          <input
            type="date"
            value={form.completed_before.value}
            onInput={(event) =>
              (form.completed_before.value = event.currentTarget.value)
            }
          />
        </label>
        <button type="submit">{t("reports.run")}</button>
      </form>
      <RequestState
        signal={signal}
        on_success={() =>
          form.report_type.value === "duration" ? (
            <DurationTable rows={signal.value.data ?? []} />
          ) : (
            <TaskCountTable rows={signal.value.data ?? []} />
          )
        }
      />
    </section>
  );
};

const ExportButtons = ({ filename, signal, columns }) => {
  const [t] = useTranslation(),
    rows = signal.value?.data ?? [],
    disabled = rows.length === 0;

  return (
    <div class="button-group">
      <button
        type="button"
        class="secondary"
        disabled={disabled}
        onClick={() => export_csv(`${filename}.csv`, rows, columns)}
      >
        {t("reports.export-csv")}
      </button>
      <button
        type="button"
        class="secondary"
        disabled={disabled}
        onClick={() => export_json(`${filename}.json`, rows)}
      >
        {t("reports.export-json")}
      </button>
    </div>
  );
};

const DurationTable = ({ rows }) => {
  const [t] = useTranslation();
  if (rows.length === 0)
    return <p class="info-box">{t("reports.no-results")}</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{t("reports.period.title")}</th>
          <th>{t("reports.minimum")}</th>
          <th>{t("reports.average")}</th>
          <th>{t("reports.maximum")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.periodUnit}-${row.period}`}>
            <th scope="row">{format_period(row, t)}</th>
            <td>{format_duration(row.minimum)}</td>
            <td>{format_duration(row.average)}</td>
            <td>{format_duration(row.maximum)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TaskCountTable = ({ rows }) => {
  const [t] = useTranslation();
  if (rows.length === 0)
    return <p class="info-box">{t("reports.no-results")}</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{t("reports.task.group")}</th>
          <th>{t("reports.task.process-definition")}</th>
          <th>{t("common.key")}</th>
          <th>{t("reports.count")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.processDefinitionId}-${row.taskDefinitionKey}`}>
            <th scope="row">
              {row.taskName ??
                row.taskDefinitionKey ??
                row.processDefinitionName ??
                "-"}
            </th>
            <td>{row.processDefinitionName ?? row.processDefinitionId ?? "-"}</td>
            <td>{row.processDefinitionKey ?? "-"}</td>
            <td>{num(row.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const format_period = (row, t) => {
  const unit = String(row.periodUnit ?? "").toLowerCase();
  if (unit === "quarter")
    return t("reports.period.quarter-value", { quarter: row.period });
  return t("reports.period.month-value", { month: row.period });
};

const duration_columns = (t) => [
  { label: t("reports.period.title"), value: (row) => format_period(row, t) },
  { label: t("reports.minimum"), value: (row) => row.minimum },
  { label: t("reports.average"), value: (row) => row.average },
  { label: t("reports.maximum"), value: (row) => row.maximum },
];

const task_count_columns = (t) => [
  {
    label: t("reports.task.group"),
    value: (row) => row.taskName ?? row.taskDefinitionKey ?? "",
  },
  {
    label: t("reports.task.process-definition"),
    value: (row) => row.processDefinitionName ?? row.processDefinitionId ?? "",
  },
  { label: t("common.key"), value: (row) => row.processDefinitionKey ?? "" },
  { label: t("reports.count"), value: (row) => row.count },
];

export { ReportsPage };
