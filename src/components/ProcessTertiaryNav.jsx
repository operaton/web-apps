import { useEffect } from 'preact/hooks'
import { useRoute, useLocation } from 'preact-iso'
import { useTranslation } from 'react-i18next'

/**
 * Tertiary nav for selected children of a definition (instance, incident,
 * called definition, job). Renders a horizontal row of links and resolves
 * the URL to the default tab when none is selected yet.
 *
 * @param tabs       [{ id, nameKey, target, ... }]
 * @param base_path  e.g. "/processes/:def/instances/:instance"
 * @param param      route param name driving the active tab (default "sub_panel")
 */
export const ProcessTertiaryNav = ({ tabs, base_path, param = 'sub_panel' }) => {
  const { params, query } = useRoute()
  const { route } = useLocation()
  const [t] = useTranslation()

  const active = params[param]
  const hist_q = query.history ? '?history=true' : ''

  // If we land on the parent path with no tab in the URL, push the default.
  useEffect(() => {
    if (!active && tabs.length) {
      route(`${base_path}/${tabs[0].id}${hist_q}`, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base_path, active])

  return (
    <nav class="processes-tertiary-nav" aria-label="Sub-section navigation">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={`${base_path}/${tab.id}${hist_q}`}
          class={`processes-tertiary-link ${active === tab.id ? 'active' : ''}`}
        >
          {tab.nameKey ? t(tab.nameKey) : tab.name}
        </a>
      ))}
    </nav>
  )
}
