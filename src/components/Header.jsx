// noinspection HtmlUnknownAnchorTarget,JSValidateTypes

import { useLocation } from 'preact-iso'
import * as Icons from "../assets/icons.jsx";
import { useHotkeys } from 'react-hotkeys-hook'

export function Header () {
  const { url, route } = useLocation()

  const showSearch = () => document.getElementById('global-search').showModal()

  useHotkeys('alt+0', () => route("/"))
  useHotkeys('alt+1', () => route("/tasks"))
  useHotkeys('alt+2', () => route("/processes"))

  return <header>
    <nav id="secondary-navigation">
      <span id="logo">
        <a href="/">Operaton BPM</a>
      </span>
      <menu>
        <menu>
          <li><a href="#content">Skip to content</a></li>
          <li><a href="#primary-navigation">Skip to Primary Navigation</a>
          </li>
        </menu>
        <menu>
          <li><a href="/accessibilty">Accessibility</a></li>
          <li><a href="/help">Help</a></li>
          <li><a href="/">Shortcuts</a></li>
        </menu>
        <menu>
          <li><a href="/about">About</a></li>
          <li><a href="/settings">Settings</a></li>
          <li><a href="/account">Account</a></li>
        </menu>
      </menu>
    </nav>
    <nav id="primary-navigation" aria-label="Main">

      <menu>
        <menu>
          <li>
            <a href="/tasks" class={url.startsWith('/tasks') && 'active'}>
              Tasks
            </a>
          </li>
        </menu>
        <menu>
          <li>
            <a href="/processes"
               class={url.startsWith('/processes') && 'active'}>
              Processes
            </a>
          </li>
          <li><a href="/">Decisions</a></li>
        </menu>
        <menu>
          <li><a href="/">Deployments</a></li>
          <li><a href="/">Batches</a></li>
          <li><a href="/">Migrations</a></li>
        </menu>
        <menu>
          <li><a href="/">Admin</a></li>
        </menu>
      </menu>

      <menu>
        <li>
          <button class="neutral" onClick={showSearch}><Icons.search /> Search <small class="font-mono">[ ALT + S ]</small> </button>
        </li>
      </menu>
    </nav>
  </header>
}
