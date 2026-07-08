import { describe, it, expect, beforeEach, vi } from "vitest";
import { signal } from "@preact/signals";
import {
  register,
  plugins_for,
  plugin_descriptor,
  plugin_state_branches,
  plugin_tabs,
  _reset_registry,
} from "./registry.js";
import { PLUGIN_POINTS } from "./points.js";
import { plugin_apis } from "../api/plugins.js";
import i18n from "../helper/i18n.js";

const en = { plugins: { p1: { nav: "Metrics" } } };
const translations = { "en-US": en };

const page = (over = {}) => ({
  id: "p1",
  point: PLUGIN_POINTS.PAGE,
  properties: { href: "/plugin/p1", nameKey: "x" },
  Component: () => null,
  ...over,
});

const tab = (over = {}) => ({
  id: "tab1",
  point: PLUGIN_POINTS.TASK_TAB,
  properties: { id: "extra", nameKey: "e" },
  Component: () => null,
  ...over,
});

beforeEach(() => {
  _reset_registry();
  for (const key of Object.keys(plugin_apis)) delete plugin_apis[key];
});

describe("plugins/registry — register", () => {
  it("accepts a valid descriptor", () => {
    expect(register(page())).toBe(true);
    expect(plugins_for(PLUGIN_POINTS.PAGE)).toHaveLength(1);
  });

  it("rejects an unknown point", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(register(page({ point: "nope" }))).toBe(false);
    expect(plugins_for(PLUGIN_POINTS.PAGE)).toHaveLength(0);
  });

  it("rejects a missing id", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(register(page({ id: undefined }))).toBe(false);
  });

  it("rejects a duplicate id", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    register(page());
    expect(register(page())).toBe(false);
    expect(plugins_for(PLUGIN_POINTS.PAGE)).toHaveLength(1);
  });

  it("mounts the api namespace under plugin_apis", () => {
    const go = vi.fn();
    register(page({ id: "withapi", api: { go } }));
    expect(plugin_apis.withapi.go).toBe(go);
  });

  it("looks up a descriptor by id", () => {
    register(page({ id: "look" }));
    expect(plugin_descriptor("look").id).toBe("look");
  });
});

describe("plugins/registry — translations", () => {
  beforeEach(() => {
    i18n.language = "en-US";
    i18n.hasResourceBundle.mockReturnValue(true);
  });

  it("deep-merges a plugin bundle once the base is loaded", () => {
    register(page({ translations }));
    expect(i18n.addResourceBundle).toHaveBeenCalledWith(
      "en-US",
      "translation",
      en,
      true, // deep merge
      false, // never overwrite host keys
    );
  });

  it("does not throw or drop the plugin when i18n has no language yet", () => {
    // Reproduces the boot-time regression: at load, i18n.language is undefined
    // and hasResourceBundle(undefined) would throw — registration must survive.
    i18n.language = undefined;
    expect(() => register(page({ id: "boot", translations }))).not.toThrow();
    expect(plugin_descriptor("boot")).toBeTruthy();
    expect(i18n.addResourceBundle).not.toHaveBeenCalled();
  });

  it("defers the merge until the base bundle finishes loading", () => {
    // Base not ready yet: nothing merged, but a `loaded` listener is attached.
    i18n.hasResourceBundle.mockReturnValue(false);
    register(page({ id: "late", translations }));
    expect(i18n.addResourceBundle).not.toHaveBeenCalled();
    expect(i18n.on).toHaveBeenCalledWith("loaded", expect.any(Function));

    // Simulate i18next finishing its backend load, then firing `loaded`.
    const on_loaded = i18n.on.mock.calls.at(-1)[1];
    i18n.hasResourceBundle.mockReturnValue(true);
    on_loaded();
    expect(i18n.addResourceBundle).toHaveBeenCalledWith(
      "en-US",
      "translation",
      en,
      true,
      false,
    );
    expect(i18n.off).toHaveBeenCalledWith("loaded", on_loaded);
  });
});

describe("plugins/registry — ordering and state", () => {
  it("returns descriptors for a point highest-priority first", () => {
    register(page({ id: "low", priority: 1 }));
    register(page({ id: "high", priority: 5 }));
    expect(plugins_for(PLUGIN_POINTS.PAGE).map((p) => p.id)).toEqual([
      "high",
      "low",
    ]);
  });

  it("builds state branches from signal factories", () => {
    register(page({ id: "s1", signals: () => ({ a: signal(42) }) }));
    const branches = plugin_state_branches();
    expect(branches.s1.a.value).toBe(42);
  });
});

describe("plugins/registry — plugin_tabs", () => {
  const base = [
    { id: "a", nameKey: "a", pos: 0, Component: () => null },
    { id: "b", nameKey: "b", pos: 1, Component: () => null },
  ];

  it("appends low-priority plugin tabs after built-ins with contiguous pos", () => {
    register(tab({ id: "t1", priority: -10 }));
    const tabs = plugin_tabs(PLUGIN_POINTS.TASK_TAB, base);
    expect(tabs.map((t) => t.id)).toEqual(["a", "b", "extra"]);
    expect(tabs.map((t) => t.pos)).toEqual([0, 1, 2]);
  });

  it("prepends positive-priority plugin tabs before built-ins", () => {
    register(
      tab({ id: "t2", priority: 5, properties: { id: "first", nameKey: "f" } }),
    );
    const tabs = plugin_tabs(PLUGIN_POINTS.TASK_TAB, base);
    expect(tabs.map((t) => t.id)).toEqual(["first", "a", "b"]);
    expect(tabs.map((t) => t.pos)).toEqual([0, 1, 2]);
  });
});
