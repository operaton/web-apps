/**
 * registry.js
 *
 * The single in-memory registry every host seam reads from. The loader
 * (`loader.js`) populates it once at boot — before the first `render()` — so
 * consumers can treat it as immutable and never need reactivity.
 *
 * A plugin descriptor (a module's default export, or one entry of an array):
 *   {
 *     id: string,                unique
 *     point: string,             one of PLUGIN_POINTS
 *     priority?: number,         sort order within a point (higher = earlier), default 0
 *     properties?: object,       point-specific config (path, href, nameKey, hotkey, id, apiBase)
 *     Component?: ComponentType,  Preact component for PAGE / *_TAB / DASHBOARD_WIDGET points
 *     api?: object,              fn leaves (state, ...args) => Promise → engine_rest.plugins[id]
 *     signals?: () => object,    factory → state.api.plugins[id]
 *     translations?: object,     { "en-US": {...}, ... } deep-merged into the translation namespace
 *   }
 */
import i18n from "../helper/i18n.js";
import { mount_plugin_api } from "../api/plugins.js";
import { PLUGIN_POINTS } from "./points.js";

const registry = [];

const is_valid = (descriptor) => {
  if (!descriptor || typeof descriptor.id !== "string") return false;
  if (!Object.values(PLUGIN_POINTS).includes(descriptor.point)) return false;
  if (registry.some((existing) => existing.id === descriptor.id)) return false;
  return true;
};

/**
 * Deep-merge a plugin's translation bundles into the shared i18n instance,
 * *after* the http backend has loaded the base translation.json.
 *
 * Adding a partial bundle for a language before its backend load makes i18next
 * treat that language as already present and skip the fetch entirely — so a
 * plugin's `en-US` keys would suppress the app's own `en-US` base keys and every
 * built-in string would report `missingKey`. We therefore wait until the base
 * bundle exists (or add immediately if a plugin is registered after load, e.g.
 * a late remote plugin).
 */
const add_translations = (translations) => {
  // True only once i18next is initialized, has an active language, and that
  // language's base bundle has loaded. Guarded so it never runs at boot with an
  // undefined language (which makes i18next throw) or against the test stub.
  const base_ready = () =>
    typeof i18n.hasResourceBundle === "function" &&
    !!i18n.language &&
    i18n.hasResourceBundle(i18n.language, "translation");

  const apply = () => {
    for (const [lng, resources] of Object.entries(translations))
      // deep merge (true), never overwrite host keys (false)
      i18n.addResourceBundle(lng, "translation", resources, true, false);
  };

  if (base_ready()) return apply();
  // `loaded` can fire per-language; keep listening until the base is actually
  // ready, then apply once and detach.
  const on_loaded = () => {
    if (!base_ready()) return;
    apply();
    i18n.off?.("loaded", on_loaded);
  };
  i18n.on?.("loaded", on_loaded);
};

/**
 * Validate and register one descriptor. Mounts its i18n bundle and API
 * namespace as a side effect. Returns whether it was accepted.
 */
export const register = (descriptor) => {
  if (!is_valid(descriptor)) {
    console.error(
      "[plugins] invalid or duplicate descriptor, skipping",
      descriptor,
    );
    return false;
  }

  if (descriptor.translations) add_translations(descriptor.translations);

  if (descriptor.api) mount_plugin_api(descriptor.id, descriptor.api);

  registry.push(descriptor);
  return true;
};

/** All descriptors for a point, highest priority first. */
export const plugins_for = (point) =>
  registry
    .filter((descriptor) => descriptor.point === point)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

/** Look up a single descriptor by id. */
export const plugin_descriptor = (id) =>
  registry.find((descriptor) => descriptor.id === id);

/** `{ [id]: signals() }` for every descriptor that declares a signal branch. */
export const plugin_state_branches = () =>
  Object.fromEntries(
    registry
      .filter((descriptor) => typeof descriptor.signals === "function")
      .map((descriptor) => [descriptor.id, descriptor.signals()]),
  );

/** Test-only: clear all registrations. */
export const _reset_registry = () => {
  registry.length = 0;
};
