import { useContext } from "preact/hooks"
import { signal, useSignal } from "@preact/signals"
import { useHotkeys } from "react-hotkeys-hook"
import { useLocation } from "preact-iso"
import { AppState } from "../state.js"
import { RESPONSE_STATE } from "../api/engine_rest.jsx"
import { _url_engine_rest, get_auth_header } from "../api/helper.jsx"

const close = () => document.getElementById("global-search").close()
const show = () => {
  const dialog = document.getElementById("global-search")
  dialog.showModal()
  dialog.querySelector("input")?.focus()
}

const CATEGORIES = [
  { key: "pages", label: "Pages" },
  { key: "tasks", label: "Tasks" },
  { key: "processes", label: "Process Definitions" },
  { key: "decisions", label: "Decision Definitions" },
  { key: "deployments", label: "Deployments" },
  { key: "lookup", label: "ID Lookup" },
]

const PAGES = [
  { name: "Dashboard", href: "/" },
  { name: "Tasks", href: "/tasks" },
  { name: "Processes", href: "/processes" },
  { name: "Decisions", href: "/decisions" },
  { name: "Deployments", href: "/deployments" },
  { name: "Migrations", href: "/migrations" },
  { name: "Admin", href: "/admin" },
  { name: "Admin – Users", href: "/admin/users" },
  { name: "Admin – Groups", href: "/admin/groups" },
  { name: "Admin – Tenants", href: "/admin/tenants" },
  { name: "Admin – Authorizations", href: "/admin/authorizations" },
  { name: "Admin – System", href: "/admin/system" },
  { name: "Account", href: "/account" },
  { name: "Help", href: "/help" },
]

const match = (text, query) =>
  text?.toLowerCase().includes(query.toLowerCase())

const collect_results = (query, state) => {
  if (!query) return []

  const results = []

  // Pages
  const pages = PAGES.filter((p) => match(p.name, query))
  if (pages.length)
    results.push({ category: "pages", items: pages.map((p) => ({ label: p.name, href: p.href })) })

  // Tasks
  const tasks = state.api.task.list.value
  if (tasks?.status === RESPONSE_STATE.SUCCESS && tasks.data) {
    const matched = tasks.data.filter((t) =>
      match(t.name, query) || match(t.id, query) || match(t.assignee, query) || match(t.definitionName, query)
    ).slice(0, 8)
    if (matched.length)
      results.push({ category: "tasks", items: matched.map((t) => ({
        label: t.name ?? "Unnamed",
        detail: t.definitionName || t.processDefinitionId,
        href: `/tasks/${t.id}`,
      })) })
  }

  // Process definitions
  const defs = state.api.process.definition.list.value
  if (defs?.status === RESPONSE_STATE.SUCCESS && defs.data) {
    const matched = defs.data.filter((d) =>
      match(d.definition?.name, query) || match(d.definition?.key, query) || match(d.definition?.id, query)
    ).slice(0, 8)
    if (matched.length)
      results.push({ category: "processes", items: matched.map((d) => ({
        label: d.definition?.name ?? d.definition?.key ?? "–",
        detail: d.definition?.key,
        href: `/processes/${d.definition?.id}`,
      })) })
  }

  // Decision definitions
  const decisions = state.api.decision.definitions.value
  if (decisions?.status === RESPONSE_STATE.SUCCESS && decisions.data) {
    const matched = decisions.data.filter((d) =>
      match(d.name, query) || match(d.key, query) || match(d.id, query)
    ).slice(0, 8)
    if (matched.length)
      results.push({ category: "decisions", items: matched.map((d) => ({
        label: d.name ?? d.key ?? "–",
        detail: d.key,
        href: `/decisions/${d.id}`,
      })) })
  }

  // Deployments
  const deployments = state.api.deployment.all.value
  if (deployments?.status === RESPONSE_STATE.SUCCESS && deployments.data) {
    const matched = deployments.data.filter((d) =>
      match(d.name, query) || match(d.id, query) || match(d.source, query)
    ).slice(0, 8)
    if (matched.length)
      results.push({ category: "deployments", items: matched.map((d) => ({
        label: d.name ?? "Unnamed",
        detail: d.id,
        href: `/deployments/${d.id}`,
      })) })
  }

  return results
}

const lookup_signal = signal(null)

const do_lookup = async (query, state) => {
  if (!query || query.length < 5) {
    lookup_signal.value = null
    return
  }

  lookup_signal.value = { status: "loading" }

  const headers = new Headers()
  headers.set("Authorization", get_auth_header(state))
  const base = _url_engine_rest(state)

  const lookups = [
    { type: "Process Definition", url: `/process-definition/${query}`, href: (d) => `/processes/${d.id}`, label: (d) => d.name ?? d.key },
    { type: "Process Instance", url: `/process-instance/${query}`, href: (d) => `/processes/${d.definitionId}`, label: (d) => d.id },
    { type: "Task", url: `/task/${query}`, href: (d) => `/tasks/${d.id}`, label: (d) => d.name ?? d.id },
    { type: "Deployment", url: `/deployment/${query}`, href: (d) => `/deployments/${d.id}`, label: (d) => d.name ?? d.id },
  ]

  const results = await Promise.all(
    lookups.map(async (l) => {
      try {
        const res = await fetch(`${base}${l.url}`, { headers })
        if (!res.ok) return null
        const data = await res.json()
        return { type: l.type, label: l.label(data), href: l.href(data) }
      } catch {
        return null
      }
    })
  )

  const found = results.filter(Boolean)
  lookup_signal.value = found.length ? { status: "success", data: found } : { status: "empty" }
}

let debounce_timer = null

const GoTo = () => (
  <dialog id="global-search" class="fade-in">
    <SearchComponent />
  </dialog>
)

const SearchComponent = () => {
  const state = useContext(AppState),
    { route } = useLocation(),
    query = useSignal(""),
    results = useSignal([]),
    selected = useSignal(0)

  useHotkeys("alt+k", () => setTimeout(show, 100))

  const update_search = (value) => {
    query.value = value
    results.value = collect_results(value, state)
    selected.value = 0

    clearTimeout(debounce_timer)
    debounce_timer = setTimeout(() => do_lookup(value, state), 300)
  }

  const flat_items = () => {
    const items = []
    for (const group of results.value)
      for (const item of group.items)
        items.push(item)

    const lk = lookup_signal.value
    if (lk?.status === "success")
      for (const item of lk.data)
        items.push(item)

    return items
  }

  const navigate = (href) => {
    close()
    query.value = ""
    results.value = []
    lookup_signal.value = null
    route(href)
  }

  const on_keydown = (e) => {
    const items = flat_items()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      selected.value = Math.min(selected.value + 1, items.length - 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      selected.value = Math.max(selected.value - 1, 0)
    } else if (e.key === "Enter" && items.length > 0) {
      e.preventDefault()
      navigate(items[selected.value].href)
    }
  }

  let item_index = 0

  return (
    <search class="goto-search">
      <header>
        <h2>Go To</h2>
        <button class="neutral" onClick={close}>Close</button>
      </header>

      <input
        autofocus
        type="search"
        placeholder="Search pages, tasks, processes, decisions..."
        class="goto-input"
        value={query.value}
        onInput={(e) => update_search(e.currentTarget.value)}
        onKeyDown={on_keydown}
      />

      <div class="goto-results" role="listbox">
        {!query.value && <p class="goto-hint">Type to search across all resources, or paste an ID for direct lookup.</p>}

        {results.value.map((group) => {
          const cat = CATEGORIES.find((c) => c.key === group.category)
          return (
            <section key={group.category}>
              <h4>{cat?.label ?? group.category}</h4>
              {group.items.map((item) => {
                const idx = item_index++
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    class={`goto-item ${idx === selected.value ? "goto-selected" : ""}`}
                    role="option"
                    aria-selected={idx === selected.value}
                    onClick={(e) => { e.preventDefault(); navigate(item.href) }}
                  >
                    <span>{item.label}</span>
                    {item.detail && <small>{item.detail}</small>}
                  </a>
                )
              })}
            </section>
          )
        })}

        {query.value && lookup_signal.value?.status === "success" && (
          <section>
            <h4>ID Lookup</h4>
            {lookup_signal.value.data.map((item) => {
              const idx = item_index++
              return (
                <a
                  key={item.href}
                  href={item.href}
                  class={`goto-item ${idx === selected.value ? "goto-selected" : ""}`}
                  role="option"
                  aria-selected={idx === selected.value}
                  onClick={(e) => { e.preventDefault(); navigate(item.href) }}
                >
                  <span>{item.label}</span>
                  <small>{item.type}</small>
                </a>
              )
            })}
          </section>
        )}

        {query.value && results.value.length === 0 && lookup_signal.value?.status === "empty" && (
          <p class="goto-empty">No results found</p>
        )}
      </div>
    </search>
  )
}

export { GoTo }
