import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { signal } from "@preact/signals";
import { ListFilter } from "./ListFilter.jsx";

const SORT_OPTIONS = [
  { key: "name", nameKey: "list_filter.sort.name" },
  { key: "key", nameKey: "list_filter.sort.key" },
];
const FILTER_KEYS = [
  { key: "nameLike", nameKey: "list_filter.keys.nameLike", type: "string" },
  { key: "active", nameKey: "list_filter.keys.active", type: "boolean" },
];

const make_saved_filters = (filters) =>
  signal({ status: "SUCCESS", data: filters });

const empty_state = {
  saved_filter_id: null,
  sortBy: "name",
  sortOrder: "asc",
  criteria: {},
};

const base_props = (overrides = {}) => ({
  sort_options: SORT_OPTIONS,
  filter_keys: FILTER_KEYS,
  saved_filters_signal: make_saved_filters([]),
  current: empty_state,
  defaults: { sortBy: "name", sortOrder: "asc" },
  on_change: vi.fn(),
  on_save: vi.fn(),
  on_update: vi.fn(),
  on_delete: vi.fn(),
  on_share: vi.fn(),
  ...overrides,
});

describe("ListFilter", () => {
  afterEach(cleanup);

  it("renders sort select with provided options", () => {
    const { getAllByText } = render(<ListFilter {...base_props()} />);
    expect(getAllByText("list_filter.sort.name").length).toBeGreaterThan(0);
    expect(getAllByText("list_filter.sort.key").length).toBeGreaterThan(0);
  });

  it("emits saved_filter_id on saved-filter change", () => {
    const on_change = vi.fn();
    const props = base_props({
      saved_filters_signal: make_saved_filters([
        { id: "abc", name: "Mine", query: { nameLike: "x" } },
      ]),
      on_change,
    });
    const { getByLabelText } = render(<ListFilter {...props} />);
    fireEvent.change(getByLabelText("list_filter.saved_filter"), {
      target: { value: "abc" },
    });
    expect(on_change).toHaveBeenCalledWith({ saved_filter_id: "abc" });
  });

  it("emits sortBy and sortOrder on change", () => {
    const on_change = vi.fn();
    const { getByLabelText } = render(
      <ListFilter {...base_props({ on_change })} />,
    );
    fireEvent.change(getByLabelText("list_filter.sort_by"), {
      target: { value: "key" },
    });
    fireEvent.change(getByLabelText("list_filter.sort_order"), {
      target: { value: "desc" },
    });
    expect(on_change).toHaveBeenNthCalledWith(1, { sortBy: "key" });
    expect(on_change).toHaveBeenNthCalledWith(2, { sortOrder: "desc" });
  });

  it("omits the 'my' preset unless include_my_filter is set", () => {
    const without = render(<ListFilter {...base_props()} />);
    expect(without.queryByText("list_filter.my")).toBeNull();
    cleanup();
    const withMy = render(
      <ListFilter {...base_props({ include_my_filter: true })} />,
    );
    expect(withMy.getByText("list_filter.my")).toBeTruthy();
  });

  it("calls on_save with a new filter when the create dialog is submitted", () => {
    const on_save = vi.fn();
    const { getByText, getByLabelText } = render(
      <ListFilter {...base_props({ on_save })} />,
    );
    fireEvent.click(getByText("list_filter.new_filter"));
    fireEvent.input(getByLabelText("list_filter.name"), {
      target: { value: "Active orders" },
    });
    fireEvent.click(getByText("list_filter.add_criterion"));
    fireEvent.input(getByText("common.value").closest("table").querySelector("input"), {
      target: { value: "order" },
    });
    fireEvent.click(getByText("common.save"));
    expect(on_save).toHaveBeenCalledTimes(1);
    expect(on_save.mock.calls[0][0]).toEqual({
      name: "Active orders",
      query: { nameLike: "order" },
    });
  });

  it("calls on_update when editing a selected saved filter", () => {
    const on_update = vi.fn();
    const props = base_props({
      saved_filters_signal: make_saved_filters([
        { id: "abc", name: "Mine", query: { nameLike: "x" } },
      ]),
      current: { ...empty_state, saved_filter_id: "abc" },
      on_update,
    });
    const { getByText, getByLabelText } = render(<ListFilter {...props} />);
    fireEvent.click(getByText("list_filter.edit"));
    fireEvent.input(getByLabelText("list_filter.name"), {
      target: { value: "Mine!" },
    });
    fireEvent.click(getByText("common.save"));
    expect(on_update).toHaveBeenCalledTimes(1);
    expect(on_update.mock.calls[0][0]).toBe("abc");
    expect(on_update.mock.calls[0][1].name).toBe("Mine!");
    expect(on_update.mock.calls[0][1].query).toEqual({ nameLike: "x" });
  });

  it("calls on_delete (and clears the selector) when delete is confirmed", () => {
    const on_delete = vi.fn();
    const on_change = vi.fn();
    const props = base_props({
      saved_filters_signal: make_saved_filters([
        { id: "abc", name: "Mine", query: {} },
      ]),
      current: { ...empty_state, saved_filter_id: "abc" },
      on_delete,
      on_change,
    });
    const { getByText } = render(<ListFilter {...props} />);
    fireEvent.click(getByText("list_filter.delete"));
    fireEvent.click(getByText("list_filter.confirm_delete"));
    expect(on_delete).toHaveBeenCalledWith("abc");
    expect(on_change).toHaveBeenCalledWith({ saved_filter_id: "all" });
  });

  it("invokes on_share when the share button is clicked", () => {
    const on_share = vi.fn();
    const { getByText } = render(
      <ListFilter {...base_props({ on_share })} />,
    );
    fireEvent.click(getByText("list_filter.share_link"));
    expect(on_share).toHaveBeenCalledTimes(1);
  });

  it("renders the advanced editor link when href is provided", () => {
    const { getByText } = render(
      <ListFilter
        {...base_props({ advanced_editor_href: "/tasks/filter" })}
      />,
    );
    const a = getByText("list_filter.advanced");
    expect(a.getAttribute("href")).toBe("/tasks/filter");
  });
});
