import engine_rest from '../api/engine_rest.jsx'
import { createPortal } from 'preact/compat'
import { useContext, useEffect, useRef } from 'preact/hooks'
import { AppState } from '../state.js'
import { useLocation, useRoute } from 'preact-iso'
import { useTranslation } from 'react-i18next'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import * as Icons from '../assets/icons.jsx'

/**
 * BPMN Diagram Viewer
 * @param xml a xml string of a bpmn diagram
 * @param container the html id for an element which gets filled with the diagram
 * @param tokens elements shown on the diagram
 * @returns {Element}
 * @constructor
 */
export const BPMNViewer = ({ xml, container, tokens, highlight }) => {

  const
    state = useContext(AppState),
    { params: { definition_id }, query } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    viewerRef = useRef(null),
    containerEl = document.getElementById(container),

    get_viewer = () => {
      if (!viewerRef.current) {
        viewerRef.current = new NavigatedViewer({
          container: containerEl,
        })
      }
      return viewerRef.current
    },

    zoom_in = () => viewerRef.current?.get('zoomScroll').stepZoom(1),
    zoom_out = () => viewerRef.current?.get('zoomScroll').stepZoom(-1),
    fit_view = () => viewerRef.current?.get('canvas').zoom('fit-viewport', 'auto')

  useEffect(() => {
    containerEl.style.position = 'relative'
    const viewer = get_viewer()

    const history_suffix = query.history ? '?history=true' : ''

    // Handle action button clicks via event delegation on the container
    const on_action_click = (e) => {
      const btn = e.target.closest('.bpmn-action-btn')
      if (!btn) return
      e.stopPropagation()

      const action = btn.dataset.action,
        activity_id = btn.dataset.activityId

      if (action === 'instances') {
        void engine_rest.process_instance.by_activity_ids(state, definition_id, [activity_id])
        route(`/processes/${definition_id}/instances${history_suffix}`)
      } else if (action === 'incidents') {
        void engine_rest.history.incident.by_process_definition(state, definition_id)
        route(`/processes/${definition_id}/incidents${history_suffix}`)
      } else if (action === 'called') {
        void engine_rest.process_definition.called(state, definition_id)
        route(`/processes/${definition_id}/called_definitions${history_suffix}`)
      }
    }

    containerEl.addEventListener('click', on_action_click)

    const load = async () => {
      try {
        await viewer.importXML(xml)
        viewer.get('canvas').zoom('fit-viewport', 'auto')
      } catch (error) {
        console.error('Error loading BPMN content', error)
        return
      }

      const overlays = viewer.get('overlays'),
        eventBus = viewer.get('eventBus'),
        elementRegistry = viewer.get('elementRegistry')

      const icon_incident = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>',
        icon_link = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>'

      tokens?.forEach(({ id, instances, incidents }) => {
        const element = elementRegistry.get(id),
          is_call_activity = element?.type === 'bpmn:CallActivity'

        if (incidents.length > 0) {
          overlays.add(id, {
            position: { top: -10, left: -10 },
            html: `<div class="bpmn-badge bpmn-badge-incident">${incidents.length}</div>`,
          })
        }

        // Build all action buttons in a single row
        let actions_html = `<button class="bpmn-badge bpmn-badge-running bpmn-action-btn" data-action="instances" data-activity-id="${id}" title="${t('bpmn.show-instances')}">${instances}</button>`

        if (incidents.length > 0) {
          actions_html += `<button class="bpmn-action-btn" data-action="incidents" data-activity-id="${id}" title="${t('bpmn.show-incidents')}">${icon_incident}</button>`
        }

        if (is_call_activity) {
          actions_html += `<button class="bpmn-action-btn" data-action="called" data-activity-id="${id}" title="${t('bpmn.show-called-activity')}">${icon_link}</button>`
        }

        overlays.add(id, {
          position: { bottom: 0, left: 0 },
          html: `<div class="bpmn-actions">${actions_html}</div>`,
        })

        const gfx = elementRegistry.getGraphics(id)
        if (gfx) gfx.classList.add('c-hand')
      })

      highlight?.forEach((elementId) => {
        const gfx = elementRegistry.getGraphics(elementId)
        if (gfx) gfx.classList.add('bpmn-highlight')
      })

      // Click on element body still filters instances
      eventBus.on('element.click', (event) => {
        const token = tokens?.find((t) => t.id === event.element.id)
        if (!token) return
        void engine_rest.process_instance.by_activity_ids(state, definition_id, [token.id])
      })
    }

    void load()

    return () => {
      containerEl.removeEventListener('click', on_action_click)
      viewer.destroy()
      viewerRef.current = null
    }
  }, [container, definition_id, xml])

  const controls = (
    <div class="bpmn-controls">
      <button onClick={zoom_in} aria-label={t("bpmn.zoom-in")} title={t("bpmn.zoom-in")}>
        <Icons.magnifying_glass_plus />
      </button>
      <button onClick={zoom_out} aria-label={t("bpmn.zoom-out")} title={t("bpmn.zoom-out")}>
        <Icons.magnifying_glass_minus />
      </button>
      <button onClick={fit_view} aria-label={t("bpmn.fit")} title={t("bpmn.fit")}>
        <Icons.arrows_pointing_out />
      </button>
    </div>
  )

  return createPortal(controls, containerEl)
}
