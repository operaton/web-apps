import engine_rest from '../api/engine_rest.jsx'
import { createPortal } from 'preact/compat'
import { useContext, useEffect, useRef } from 'preact/hooks'
import { AppState } from '../state.js'
import { useRoute } from 'preact-iso'
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
    { params: { definition_id } } = useRoute(),
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

      tokens?.forEach(({ id, instances, incidents }) => {
        overlays.add(id, {
          position: { bottom: 0, left: 0 },
          html: `<div class="bpmn-badge bpmn-badge-running">${instances}</div>`,
        })

        if (incidents.length > 0) {
          overlays.add(id, {
            position: { top: -10, left: -10 },
            html: `<div class="bpmn-badge bpmn-badge-incident">${incidents.length}</div>`,
          })
        }

        const gfx = elementRegistry.getGraphics(id)
        if (gfx) gfx.classList.add('c-hand')
      })

      highlight?.forEach((elementId) => {
        const gfx = elementRegistry.getGraphics(elementId)
        if (gfx) gfx.classList.add('bpmn-highlight')
      })

      eventBus.on('element.click', (event) => {
        const token = tokens?.find((t) => t.id === event.element.id)
        if (!token) return

        const { id, incidents } = token,
          element = elementRegistry.get(id),
          is_call_activity = element?.type === 'bpmn:CallActivity'

        if (!is_call_activity && incidents.length === 0) {
          void engine_rest.process_instance.by_activity_ids(state, definition_id, [id])
          return
        }

        const modal = document.getElementById('digagram-modal')
        modal.showModal()
        document.getElementById('show_running_instances').addEventListener('click', () => {
          void engine_rest.process_instance.by_activity_ids(state, definition_id, [id])
          modal.close()
        })
        if (incidents.length > 0) {
          document.getElementById('show_incidents').disabled = false
        }
        if (is_call_activity) {
          document.getElementById('show_called_activities').disabled = false
        }
      })
    }

    void load()

    return () => {
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

  return <>
    {createPortal(controls, containerEl)}

    <dialog id="digagram-modal" className="digagram-modal">
      <h3>Available Actions for this task</h3>

      <button id="show_running_instances">Show running instances</button>
      <br />
      <button id="show_incidents" disabled>Show running instances</button>
      <br />
      <button id="show_called_activities" disabled>Show called activity (sub-process)</button>
      <br />
      <br />

      <form method="dialog">
        <button>Close</button>
      </form>

    </dialog>
  </>
}
