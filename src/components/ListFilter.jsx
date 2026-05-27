import { useSignal } from "@preact/signals";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "preact/hooks";
import { Dialog, ConfirmDialog } from "./Dialog.jsx";
import * as Icons from "../assets/icons.jsx";

/**
 * Shared toolbar + edit dialog used by every list page (Tasks, Process
 * Definitions, Decisions, Deployments, Batches). The component is
 * resource-agnostic: the page declares which sort options and which filter
 * criteria its API endpoint accepts, and supplies callbacks to persist
 * saved filters (server-side for Tasks, localStorage elsewhere).
 *
 * @param sort_options       {Array<{ key, nameKey }>}
 * @param filter_keys        {Array<{ key, nameKey, type? }>}  type: string|enum|boolean|date
 * @param saved_filters_signal {Signal<{ status, data: SavedFilter[] } | null>}
 * @param current            {{ saved_filter_id, sortBy, sortOrder, criteria }}
 * @param defaults           {{ sortBy, sortOrder }}
 * @param include_my_filter  {boolean} — adds the "My" preset (Tasks only)
 * @param on_change          {(patch) => void}
 * @param on_save            {(filter) => void}
 * @param on_update          {(id, filter) => void}
 * @param on_delete          {(id) => void}
 * @param on_share           {() => void}
 * @param advanced_editor_href {string} optional — link to the advanced editor route
 * @param filter_predicate   {(SavedFilter) => boolean} optional gate for which
 *                           saved filters to display
 */
export const ListFilter = ({
  sort_options,
  filter_keys,
  saved_filters_signal,
  current,
  defaults = { sortBy: "", sortOrder: "asc" },
  include_my_filter = false,
  on_change,
  on_save,
  on_update,
  on_delete,
  on_share,
  advanced_editor_href,
  filter_predicate = (f) => f && f.id,
}) => {
  const [t] = useTranslation();
  const edit_open = useSignal(false);
  const delete_open = useSignal(false);
  const edit_form = useSignal(empty_form());

  const saved_filters = (saved_filters_signal?.value?.data ?? []).filter(
    filter_predicate,
  );
  const selected_saved = useMemo(
    () => saved_filters.find((f) => f.id === current.saved_filter_id) ?? null,
    [saved_filters, current.saved_filter_id],
  );
  const is_known_saved_id =
    current.saved_filter_id !== null &&
    current.saved_filter_id !== "all" &&
    current.saved_filter_id !== "my";

  const open_create = () => {
    edit_form.value = empty_form();
    edit_open.value = true;
  };
  const open_edit = () => {
    if (!selected_saved) return;
    edit_form.value = {
      id: selected_saved.id,
      name: selected_saved.name ?? "",
      sortBy: selected_saved.sort?.sortBy ?? "",
      sortOrder: selected_saved.sort?.sortOrder ?? "asc",
      criteria: Object.entries(selected_saved.query ?? {}).map(
        ([key, value]) => ({ key, value: String(value) }),
      ),
    };
    edit_open.value = true;
  };

  const submit_form = (event) => {
    event.preventDefault();
    const f = edit_form.value;
    const query = {};
    for (const { key, value } of f.criteria) {
      const meta = filter_keys.find((k) => k.key === key);
      if (!meta || value === "" || value === undefined || value === null)
        continue;
      query[key] = coerce_value(meta.type, value);
    }
    const filter = {
      name: f.name.trim(),
      query,
      ...(f.sortBy ? { sort: { sortBy: f.sortBy, sortOrder: f.sortOrder } } : {}),
    };
    if (f.id) on_update?.(f.id, filter);
    else on_save?.(filter);
    edit_open.value = false;
  };

  return (
    <div id="list-filter">
      <div class="list-filter-group">
        <label for="list-filter-saved">{t("list_filter.saved_filter")}</label>
        <select
          id="list-filter-saved"
          value={current.saved_filter_id ?? "all"}
          onChange={(e) =>
            on_change?.({ saved_filter_id: e.currentTarget.value })
          }
        >
          <option value="all">{t("list_filter.all")}</option>
          {include_my_filter && (
            <option value="my">{t("list_filter.my")}</option>
          )}
          {saved_filters.length > 0 && <option disabled>──────────</option>}
          {saved_filters.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {is_known_saved_id && selected_saved && (
          <>
            <button type="button" onClick={open_edit}>
              {t("list_filter.edit")}
            </button>
            <button
              type="button"
              class="danger"
              onClick={() => (delete_open.value = true)}
            >
              {t("list_filter.delete")}
            </button>
          </>
        )}
        <button type="button" onClick={open_create}>
          {t("list_filter.new_filter")}
        </button>
        {advanced_editor_href && (
          <a href={advanced_editor_href} class="button">
            {t("list_filter.advanced")}
          </a>
        )}
        <button
          type="button"
          class="share"
          onClick={on_share}
          aria-label={t("list_filter.share_link")}
          title={t("list_filter.share_link")}
        >
          <Icons.link_out />
          {t("list_filter.share_link")}
        </button>
      </div>
      <div class="list-filter-group">
        <label for="list-filter-sort-by">{t("list_filter.sort_by")}</label>
        <select
          id="list-filter-sort-by"
          value={current.sortBy ?? defaults.sortBy}
          onChange={(e) => on_change?.({ sortBy: e.currentTarget.value })}
        >
          {sort_options.map((o) => (
            <option key={o.key} value={o.key}>
              {t(o.nameKey)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("list_filter.sort_order")}
          value={current.sortOrder ?? defaults.sortOrder}
          onChange={(e) => on_change?.({ sortOrder: e.currentTarget.value })}
        >
          <option value="asc">{t("list_filter.asc")}</option>
          <option value="desc">{t("list_filter.desc")}</option>
        </select>
      </div>

      <Dialog
        open={edit_open}
        title={
          edit_form.value.id
            ? t("list_filter.edit_filter_title")
            : t("list_filter.new_filter_title")
        }
      >
        <FilterEditForm
          form={edit_form}
          filter_keys={filter_keys}
          sort_options={sort_options}
          on_submit={submit_form}
          on_cancel={() => (edit_open.value = false)}
        />
      </Dialog>

      {is_known_saved_id && selected_saved && (
        <ConfirmDialog
          open={delete_open}
          message={t("list_filter.delete_confirm", {
            name: selected_saved.name ?? "",
          })}
          confirm_label="list_filter.confirm_delete"
          on_confirm={() => {
            on_delete?.(selected_saved.id);
            on_change?.({ saved_filter_id: "all" });
          }}
        />
      )}
    </div>
  );
};

const empty_form = () => ({
  id: null,
  name: "",
  sortBy: "",
  sortOrder: "asc",
  criteria: [],
});

const coerce_value = (type, value) => {
  if (type === "boolean") return value === true || value === "true";
  if (type === "number") return Number(value);
  return value;
};

const FilterEditForm = ({
  form,
  filter_keys,
  sort_options,
  on_submit,
  on_cancel,
}) => {
  const [t] = useTranslation();

  // Reset criteria rows to legal keys if filter_keys changes
  useEffect(() => {
    const allowed = new Set(filter_keys.map((k) => k.key));
    const cleaned = form.value.criteria.filter((c) => allowed.has(c.key));
    if (cleaned.length !== form.value.criteria.length)
      form.value = { ...form.peek(), criteria: cleaned };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter_keys]);

  const update = (key, value) =>
    (form.value = { ...form.peek(), [key]: value });
  const add_criterion = () =>
    update("criteria", [
      ...form.peek().criteria,
      { key: filter_keys[0]?.key ?? "", value: "" },
    ]);
  const remove_criterion = (index) =>
    update(
      "criteria",
      form.peek().criteria.filter((_, i) => i !== index),
    );
  const update_criterion = (index, field, value) =>
    update(
      "criteria",
      form.peek().criteria.map((c, i) =>
        i === index ? { ...c, [field]: value } : c,
      ),
    );

  return (
    <form onSubmit={on_submit} class="filter-edit-form">
      <label for="list-filter-name">{t("list_filter.name")}</label>
      <input
        id="list-filter-name"
        required
        value={form.value.name}
        onInput={(e) => update("name", e.currentTarget.value)}
      />

      <fieldset>
        <legend>{t("list_filter.criteria")}</legend>
        {form.value.criteria.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t("common.key")}</th>
                <th>{t("common.value")}</th>
                <th>{t("common.action")}</th>
              </tr>
            </thead>
            <tbody>
              {form.value.criteria.map((criterion, i) => {
                const meta = filter_keys.find((k) => k.key === criterion.key);
                return (
                  <tr key={i}>
                    <td>
                      <select
                        value={criterion.key}
                        onChange={(e) =>
                          update_criterion(i, "key", e.currentTarget.value)
                        }
                      >
                        {filter_keys.map((k) => (
                          <option key={k.key} value={k.key}>
                            {t(k.nameKey)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <CriterionValueInput
                        meta={meta}
                        value={criterion.value}
                        on_change={(v) => update_criterion(i, "value", v)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => remove_criterion(i)}
                      >
                        {t("common.remove")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <button type="button" onClick={add_criterion}>
          {t("list_filter.add_criterion")}
        </button>
      </fieldset>

      <fieldset>
        <legend>{t("list_filter.sort_override")}</legend>
        <label for="list-filter-form-sort-by">
          {t("list_filter.sort_override_by")}
        </label>
        <select
          id="list-filter-form-sort-by"
          value={form.value.sortBy}
          onChange={(e) => update("sortBy", e.currentTarget.value)}
        >
          <option value="">{t("list_filter.no_override")}</option>
          {sort_options.map((o) => (
            <option key={o.key} value={o.key}>
              {t(o.nameKey)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("list_filter.sort_override_order")}
          value={form.value.sortOrder}
          onChange={(e) => update("sortOrder", e.currentTarget.value)}
        >
          <option value="asc">{t("list_filter.asc")}</option>
          <option value="desc">{t("list_filter.desc")}</option>
        </select>
      </fieldset>

      <div class="button-group">
        <button type="submit">{t("common.save")}</button>
        <button type="button" onClick={on_cancel}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
};

const CriterionValueInput = ({ meta, value, on_change }) => {
  if (!meta) return <input value={value} onInput={(e) => on_change(e.currentTarget.value)} />;
  if (meta.type === "boolean")
    return (
      <select value={value} onChange={(e) => on_change(e.currentTarget.value)}>
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  if (meta.type === "enum" && Array.isArray(meta.options))
    return (
      <select value={value} onChange={(e) => on_change(e.currentTarget.value)}>
        <option value="">—</option>
        {meta.options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o.value ?? o}
          </option>
        ))}
      </select>
    );
  if (meta.type === "date")
    return (
      <input
        type="datetime-local"
        value={value}
        onInput={(e) => on_change(e.currentTarget.value)}
      />
    );
  return (
    <input value={value} onInput={(e) => on_change(e.currentTarget.value)} />
  );
};
