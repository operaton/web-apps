// noinspection HtmlUnknownAnchorTarget,JSValidateTypes

import { useLocation } from "preact-iso"
import * as Icons from "../assets/icons.jsx"
import { useHotkeys } from "react-hotkeys-hook"
import { useContext } from "preact/hooks"
import { useTranslation } from "react-i18next"
import { AppState } from "../state.js"
import engine_rest from "../api/engine_rest.jsx"

const servers = JSON.parse(import.meta.env.VITE_BACKEND)

const swap_server = (e, state) => {
  const server = servers.find((s) => s.url === e.target.value)
  state.server.value = server
  localStorage.setItem("server", JSON.stringify(server))
}

export function Header() {
  const { url, route } = useLocation(),
    state = useContext(AppState),
    [t] = useTranslation(),
    // dialogs
    showSearch = () => document.getElementById("global-search").showModal(),
    show_mobile_menu = () => document.getElementById("mobile-menu").showModal(),
    close_mobile_menu = () => document.getElementById("mobile-menu").close(),
    logout = () => engine_rest.auth.logout(state),
    // Move focus (not just the scroll position) to the skip target. In an SPA
    // the router intercepts the hash link, so native fragment focus never
    // happens; do it explicitly and make the target programmatically focusable.
    skip_to = (e, id) => {
      const target = document.getElementById(id)
      if (!target) return
      e.preventDefault()
      target.setAttribute("tabindex", "-1")
      target.focus()
      target.scrollIntoView()
    }

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
        {/* {import.meta.env.VITE_HIDE_RELEASE_WARNING === "true"
          ? null
          : <div id="release-warning">
              {t("nav.release-warning")}{" "}
              <a href="https://github.com/operaton/web-apps/issues">{t("nav.release-warning-issue")}</a>{" "}
              {t("nav.release-warning-forum") !== t("nav.release-warning-issue") && <>
                {t("nav.release-warning-or")}{" "}
                <a href="https://forum.operaton.org/">{t("nav.release-warning-forum")}</a>
              </>}
            </div>}*/}

        <menu id="skip-links">
          <li><a href="#content"            onClick={(e) => skip_to(e, "content")}>           {t("nav.skip-to-content")}</a></li>
          <li><a href="#primary-navigation" onClick={(e) => skip_to(e, "primary-navigation")}>{t("nav.skip-to-navigation")}</a></li>
        </menu>


        <a href="/" id="mobile-logo">OPERATON</a>
        <button type="button" id="mobile-menu-toggle" onClick={show_mobile_menu} aria-label={t("nav.menu")} />
        <div id="nav-wrapper">
          <nav id="primary-navigation" aria-label={t("nav.main-navigation")}>
            <menu>
              <li><a href="/"            aria-current={url === "/" ? "page" : undefined}                    id="logo">OPERATON</a></li>
              <li><a href="/tasks"       aria-current={url.startsWith("/tasks")       ? "page" : undefined}>{t("nav.tasks")}</a></li>
              <li><a href="/processes"   aria-current={url.startsWith("/processes")   ? "page" : undefined}>{t("nav.processes")}</a></li>
              <li><a href="/decisions"   aria-current={url.startsWith("/decisions")   ? "page" : undefined}>{t("nav.decisions")}</a></li>
              <li><a href="/deployments" aria-current={url.startsWith("/deployments") ? "page" : undefined}>{t("nav.deployments")}</a></li>
              <li><a href="/batches"     aria-current={url.startsWith("/batches")     ? "page" : undefined}>{t("nav.batches")}</a></li>
              <li><a href="/migrations"  aria-current={url.startsWith("/migrations")  ? "page" : undefined}>{t("nav.migrations")}</a></li>
              <li><a href="/admin"       aria-current={url.startsWith("/admin")       ? "page" : undefined}>{t("nav.admin")}</a></li>
            </menu>
          </nav>
          <div>
            <nav id="secondary-navigation">
              <menu>
                <li><a href="/help">   {t("nav.help")}</a></li>
                <li><a href="/account">{t("nav.account")}</a></li>
              </menu>
            </nav>
            <button type="button" id="go-to" onClick={showSearch}>
              {t("nav.go-to")} <kbd>Alt+K</kbd>
            </button>
            <label id="server-selector">
              {/* <Icons.server />*/}
              <select aria-label={t("nav.choose-server")} onChange={(e) => swap_server(e, state)}>
                <option disabled>{t("nav.choose-server")}</option>
                {servers.map((server) =>
                  <option key={server.url} value={server.url} selected={state.server.value?.url === server.url}>
                    {server.name} {server.c7_mode ? "(C7)" : ""}
                  </option>)}
              </select>
            </label>
            <button type="button" id="logout" onClick={logout}>{t("nav.logout")}</button>
          </div>
        </div>
      </header>

      <dialog id="mobile-menu">
        <header>
          <h2>{t("nav.menu")}</h2>
          <button type="button" onClick={close_mobile_menu} aria-label={t("nav.close-menu")}>
            <Icons.close />
          </button>
        </header>
        <nav aria-label={t("nav.mobile-navigation")}>
          <menu>
            <li>
              <a href="/tasks" aria-current={url.startsWith("/tasks") ? "page" : undefined}>
                {t("nav.tasks")}
              </a>
            </li>
            <li>
              <a
                href="/processes"
                aria-current={url.startsWith("/processes") ? "page" : undefined}
              >
                {t("nav.processes")}
              </a>
            </li>
            <li>
              <a
                href="/decisions"
                aria-current={url.startsWith("/decisions") ? "page" : undefined}
              >
                {t("nav.decisions")}
              </a>
            </li>
            <li>
              <a
                href="/deployments"
                aria-current={url.startsWith("/deployments") ? "page" : undefined}
              >
                {t("nav.deployments")}
              </a>
            </li>
            <li>
              <a href="/batches" aria-current={url.startsWith("/batches") ? "page" : undefined}>
                {t("nav.batches")}
              </a>
            </li>
            <li>
              <a
                href="/migrations"
                aria-current={url.startsWith("/migrations") ? "page" : undefined}
              >
                {t("nav.migrations")}
              </a>
            </li>
            <li>
              <a href="/admin" aria-current={url.startsWith("/admin") ? "page" : undefined}>
                {t("nav.admin")}
              </a>
            </li>
          </menu>
          <menu>
            <li>
              <a href="/help">{t("nav.help")}</a>
            </li>
            <li>
              <a href="/account">{t("nav.account")}</a>
            </li>
            <li>
              <button
                type="button"
                id="mobile-logout"
                onClick={() => {
                  close_mobile_menu()
                  logout()
                }}
              >
                {t("nav.logout")}
              </button>
            </li>
          </menu>
        </nav>
        <menu>
          <li>
            <button
              type="button"
              onClick={() => {
                close_mobile_menu()
                showSearch()
              }}
            >
              <Icons.search />
              {t("nav.go-to")}
            </button>
          </li>
          <li>
            <label id="mobile-server-selector">
              <Icons.server />
              <select aria-label={t("nav.choose-server")} onChange={(e) => swap_server(e, state)}>
                <option disabled>{t("nav.choose-server")}</option>
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
