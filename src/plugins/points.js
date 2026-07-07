/**
 * points.js
 *
 * The named extension points a plugin can contribute to. A plugin descriptor's
 * `point` must be one of these values; the host renders the descriptor at the
 * matching seam (see `docs/Plugin System.md`).
 */
export const PLUGIN_POINTS = {
  // A whole new app section: route + primary-nav entry + optional hotkey + GoTo entry.
  PAGE: "app.page",
  // A tab injected into the process-definition panel (Processes page).
  PROCESS_DEFINITION_TAB: "processes.definition.tab",
  // A tab injected into the task detail panel (Tasks page).
  TASK_TAB: "tasks.task.tab",
  // A card rendered on the dashboard.
  DASHBOARD_WIDGET: "dashboard.widget",
  // Pure API/state namespace, no UI.
  API: "app.api",
};
