// noinspection HtmlUnknownAnchorTarget,JSValidateTypes

import { useLocation } from "preact-iso"
import * as Icons from "../assets/icons.jsx"
import { useHotkeys } from "react-hotkeys-hook"
import { useContext } from "preact/hooks"
import { AppState } from "../state.js"

const servers = JSON.parse(import.meta.env.VITE_BACKEND)

const swap_server = (e, state) => {
  const server = servers.find((s) => s.url === e.target.value)
  state.server.value = server
  localStorage.setItem("server", JSON.stringify(server))
}

export function Header() {
  const { url, route } = useLocation(),
    state = useContext(AppState),
    // dialogs
    showSearch = () => document.getElementById("global-search").showModal(),
    show_mobile_menu = () => document.getElementById("mobile-menu").showModal(),
    close_mobile_menu = () => document.getElementById("mobile-menu").close()

  useHotkeys("alt+shift+0", () => route("/"))
  useHotkeys("alt+shift+1", () => route("/tasks"))
  useHotkeys("alt+shift+2", () => route("/processes"))
  useHotkeys("alt+shift+3", () => route("/decisions"))
  useHotkeys("alt+shift+4", () => route("/deployments"))
  useHotkeys("alt+shift+5", () => route("/batches"))
  useHotkeys("alt+shift+6", () => route("/migrations"))
  useHotkeys("alt+shift+7", () => route("/admin"))

  return (
    <>
      <header id="top">
        {import.meta.env.VITE_HIDE_RELEASE_WARNING === "true"
          ? null
          : <div id="release-warning">
              Public Alpha Release – Untested and not ready for production – Share your feedback with an 
              <a href="https://github.com/operaton/web-apps/issues">issue</a> or in the 
              <a href="https://forum.operaton.org/">forum</a>
            </div>}

        <menu id="skip-links">
          <li><a href="#content">           Skip to content</a></li>
          <li><a href="#primary-navigation">Skip to Primary Navigation</a></li>
        </menu>


        <div id="nav-wrapper">
          <nav id="primary-navigation" aria-label="Main">
            <menu>
              <li><a href="/"            class={url === "/" && "active"}          id="logo">OPERATON</a></li>
              <li><a href="/tasks"       class={url.startsWith("/tasks")       && "active"}>Tasks</a></li>
              <li><a href="/processes"   class={url.startsWith("/processes")   && "active"}>Processes</a></li>
              <li><a href="/decisions"   class={url.startsWith("/decisions")   && "active"}>Decisions</a></li>
              <li><a href="/deployments" class={url.startsWith("/deployments") && "active"}>Deployments</a></li>
              <li><a href="/">                                                              Batches</a></li>
              <li><a href="/migrations"  class={url.startsWith("/migrations")  && "active"}>Migrations</a></li>
              <li><a href="/admin"       class={url.startsWith("/admin")       && "active"}>Admin</a></li>
            </menu>
          </nav>
          <div>
            <nav id="secondary-navigation">
              <menu>
                <li><a href="/help">   Help</a></li>
                <li><a href="/account">Account</a></li>
              </menu>
            </nav>
            <button id="go-to" onClick={showSearch}>
              {/* <Icons.search />*/}
              Go To
            </button>
            <label id="server-selector" title="Server selection">
              {/* <Icons.server />*/}
              <select onChange={(e) => swap_server(e, state)}>
                <option disabled>Choose a server</option>
                {servers.map((server) => 
                  <option key={server.url} value={server.url} selected={state.server.value?.url === server.url}>
                    {server.name} {server.c7_mode ? "(C7)" : ""}
                  </option>)}
              </select>
            </label>
          </div>
        </div>
      </header>

      <dialog id="mobile-menu">
        <header>
          <h2>Menu</h2>
          <button onClick={close_mobile_menu} aria-label="Close menu">
            <Icons.close />
          </button>
        </header>
        <nav aria-label="Mobile navigation">
          <menu>
            <li>
              <a href="/tasks" class={url.startsWith("/tasks") && "active"}>
                Tasks
              </a>
            </li>
            <li>
              <a
                href="/processes"
                class={url.startsWith("/processes") && "active"}
              >
                Processes
              </a>
            </li>
            <li>
              <a
                href="/decisions"
                class={url.startsWith("/decisions") && "active"}
              >
                Decisions
              </a>
            </li>
            <li>
              <a
                href="/deployments"
                class={url.startsWith("/deployments") && "active"}
              >
                Deployments
              </a>
            </li>
            <li>
              <a href="/">Batches</a>
            </li>
            <li>
              <a
                href="/migrations"
                class={url.startsWith("/migrations") && "active"}
              >
                Migrations
              </a>
            </li>
            <li>
              <a href="/admin" class={url.startsWith("/admin") && "active"}>
                Admin
              </a>
            </li>
          </menu>
          <menu>
            <li>
              <a href="/help">Help</a>
            </li>
            <li>
              <a href="/account">Account</a>
            </li>
          </menu>
        </nav>
        <menu>
          <li>
            <button
              onClick={() => {
                close_mobile_menu()
                showSearch()
              }}
            >
              <Icons.search />
              Go To
            </button>
          </li>
          <li>
            <label id="mobile-server-selector" title="Server selection">
              <Icons.server />
              <select onChange={(e) => swap_server(e, state)}>
                <option disabled>Choose a server</option>
                {servers.map((server) => (
                  <option
                    key={server.url}
                    value={server.url}
                    selected={state.server.value?.url === server.url}
                  >
                    {server.name} {server.c7_mode ? "(C7)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </li>
        </menu>
      </dialog>
    </>
  )
}
