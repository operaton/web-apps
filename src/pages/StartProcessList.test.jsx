import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { h } from "preact";
import { render, cleanup, fireEvent } from "@testing-library/preact";

// Spy all engine_rest API functions but keep RequestState/RESPONSE_STATE real.
vi.mock("../api/engine_rest.jsx", async (importOriginal) => {
  const actual = await importOriginal();
  const spyify = (o) =>
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => [
        k,
        typeof v === "function"
          ? vi.fn()
          : v && typeof v === "object"
            ? spyify(v)
            : v,
      ]),
    );
  return { ...actual, default: spyify(actual.default) };
});

vi.mock("../components/Breadcrumbs.jsx", () => ({
  Breadcrumbs: () => h("nav", { "data-testid": "breadcrumbs" }),
}));

// Stub CamundaForm (avoids feelin) and expose the schema it receives.
vi.mock("../components/CamundaForm.jsx", () => ({
  CamundaForm: ({ schema }) =>
    h("div", { "data-testid": "camunda-form" }, JSON.stringify(schema)),
}));

let mockParams = {};
vi.mock("preact-iso", () => ({
  useRoute: () => ({ params: mockParams }),
  useLocation: () => ({ route: vi.fn(), path: "/tasks/start" }),
}));

import { AppState } from "../state.js";
import engine_rest from "../api/engine_rest.jsx";
import { StartProcessList } from "./StartProcessList.jsx";
import { create_mock_state, signal_response } from "../test/helpers.js";

const renderPage = (state) =>
  render(h(AppState.Provider, { value: state }, h(StartProcessList, {})));

describe("StartProcessList", () => {
  let state;
  beforeEach(() => {
    state = create_mock_state();
    mockParams = { tab: null };
    // The form dispatch chains start_form().then(...), so it must resolve.
    engine_rest.process_definition.start_form.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("fetches the startable process definitions on render", () => {
    renderPage(state);
    expect(engine_rest.process_definition.list_startable).toHaveBeenCalled();
    expect(engine_rest.process_definition.list_startable.mock.lastCall[0]).toBe(
      state,
    );
  });

  it("renders the startable process list with links to start each one", () => {
    signal_response(state.api.process.definition.list, [
      { id: "p1", name: "Invoice", version: 1, description: "d", key: "inv" },
      {
        id: "p2",
        name: "Onboarding",
        version: 2,
        description: "x",
        key: "onb",
      },
    ]);
    const { getByText } = renderPage(state);
    expect(getByText("Invoice").getAttribute("href")).toBe("/tasks/start/p1");
    expect(getByText("Onboarding").getAttribute("href")).toBe(
      "/tasks/start/p2",
    );
  });

  it("filters the list by the search term", () => {
    signal_response(state.api.process.definition.list, [
      { id: "p1", name: "Invoice", version: 1, description: "d", key: "inv" },
      {
        id: "p2",
        name: "Onboarding",
        version: 2,
        description: "x",
        key: "onb",
      },
    ]);
    const { getByText, queryByText, container } = renderPage(state);
    const input = container.querySelector("#process-popup-search-input");
    fireEvent.change(input, { target: { value: "invo" } });
    expect(getByText("Invoice")).toBeTruthy();
    expect(queryByText("Onboarding")).toBeNull();
  });

  it("prompts to select a definition when no tab is in the route", () => {
    mockParams = {};
    const { getByText } = renderPage(state);
    expect(getByText("tasks.start-process.select-definition")).toBeTruthy();
  });

  it("fetches the selected process definition when a tab is in the route", () => {
    mockParams = { tab: "p1" };
    renderPage(state);
    expect(engine_rest.process_definition.one).toHaveBeenCalled();
    expect(engine_rest.process_definition.one.mock.lastCall[1]).toBe("p1");
  });

  it("loads the start form once the selected definition resolves", () => {
    mockParams = { tab: "p1" };
    signal_response(state.api.process.definition.one, { id: "p1", key: "inv" });
    // The form dispatch fetches the start form metadata by definition id, then
    // resolves the source from its form key.
    signal_response(state.api.process.definition.start_form, {
      key: "embedded:app:inv",
    });
    renderPage(state);
    expect(engine_rest.process_definition.start_form).toHaveBeenCalled();
    expect(engine_rest.process_definition.start_form.mock.lastCall[1]).toBe(
      "p1",
    );
  });

  it("shows the migration notice for a legacy (embedded:app) start form", async () => {
    mockParams = { tab: "p1" };
    signal_response(state.api.process.definition.one, { id: "p1", key: "inv" });
    signal_response(state.api.process.definition.start_form, {
      key: "embedded:app:inv",
    });
    engine_rest.process_definition.start_form.mockResolvedValue(undefined);
    const { findByText } = renderPage(state);
    expect(await findByText(/legacy-html-unsupported/)).toBeTruthy();
  });

  it("renders a generated start form (embedded:engine key) through CamundaForm", async () => {
    mockParams = { tab: "p1" };
    signal_response(state.api.process.definition.one, { id: "p1", key: "kyc" });
    signal_response(state.api.process.definition.start_form, {
      key: "embedded:engine://engine/:engine/process-definition/p1/rendered-form",
    });
    engine_rest.process_definition.start_form.mockResolvedValue(undefined);
    // The dispatch resets rendered_form then fetches it; the mock populates it.
    engine_rest.process_definition.rendered_start_form.mockImplementation(() => {
      signal_response(
        state.api.process.definition.rendered_form,
        '<form><div class="form-group"><label>Full name</label>' +
          '<input cam-variable-name="fullName" cam-variable-type="String" type="text" value="Erika" required/>' +
          "</div></form>",
      );
    });
    const { findByTestId } = renderPage(state);
    const schema = JSON.parse((await findByTestId("camunda-form")).textContent);
    expect(schema.components.map((c) => c.key)).toEqual(["fullName"]);
    expect(schema.components[0].validate.required).toBe(true);
  });
});
