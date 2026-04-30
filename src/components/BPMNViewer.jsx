import engine_rest, { RESPONSE_STATE } from '../api/engine_rest.jsx'
import { createPortal } from 'preact/compat'
import { useContext, useEffect, useRef } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import { AppState } from '../state.js'
import { useLocation, useRoute } from 'preact-iso'
import { useTranslation } from 'react-i18next'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import * as Icons from '../assets/icons.jsx'

const FLOW_NODE_TYPES = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:ManualTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
  'bpmn:Transaction',
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent',
  'bpmn:ExclusiveGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:EventBasedGateway',
  'bpmn:ComplexGateway',
])

const is_flow_node = (element) =>
  !!element && FLOW_NODE_TYPES.has(element.type)

/**
 * BPMN Diagram Viewer
 * @param xml a xml string of a bpmn diagram
 * @param container the html id for an element which gets filled with the diagram
 * @param tokens elements shown on the diagram
 * @param mode 'definition' (default) shows aggregate action buttons; 'instance' shows draggable token dots
 * @param instance_id required when mode='instance'; the process instance id used for modification
 * @returns {Element}
 * @constructor
 */
export const BPMNViewer = ({ xml, container, tokens, highlight, mode = 'definition', instance_id }) => {

  const
    state = useContext(AppState),
    { params: { definition_id }, query } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    viewerRef = useRef(null),
    containerEl = document.getElementById(container),
    modify_request = useSignal(null),

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

    // Definition-mode: action button clicks via event delegation on the container
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

    // Instance-mode: drag-and-drop modification
    const drag_state = { source_id: null, source_instance_ids: [], target_el: null }

    const on_drag_start = (e) => {
      const dot = e.target.closest('.bpmn-token-dot')
      if (!dot) return
      drag_state.source_id = dot.dataset.activityId
      drag_state.source_instance_ids = (dot.dataset.activityInstanceIds || '').split(',').filter(Boolean)
      dot.classList.add('dragging')
      // Required for Firefox to start drag
      e.dataTransfer.setData('text/plain', drag_state.source_id)
      e.dataTransfer.effectAllowed = 'move'
    }

    const on_drag_end = (e) => {
      const dot = e.target.closest('.bpmn-token-dot')
      if (dot) dot.classList.remove('dragging')
      if (drag_state.target_el) drag_state.target_el.classList.remove('bpmn-drop-target')
      drag_state.source_id = null
      drag_state.source_instance_ids = []
      drag_state.target_el = null
    }

    const find_target_element = (clientX, clientY) => {
      if (!viewerRef.current) return null
      const elementRegistry = viewerRef.current.get('elementRegistry')
      const els = document.elementsFromPoint(clientX, clientY)
      for (const el of els) {
        const gfx = el.closest('.djs-element')
        if (!gfx) continue
        const id = gfx.dataset.elementId
        if (!id) continue
        const element = elementRegistry.get(id)
        if (is_flow_node(element)) return element
      }
      return null
    }

    const on_drag_over = (e) => {
      if (!drag_state.source_id) return
      const target = find_target_element(e.clientX, e.clientY)
      if (!target || target.id === drag_state.source_id) {
        if (drag_state.target_el) drag_state.target_el.classList.remove('bpmn-drop-target')
        drag_state.target_el = null
        return
      }
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const elementRegistry = viewerRef.current.get('elementRegistry')
      const gfx = elementRegistry.getGraphics(target.id)
      if (gfx !== drag_state.target_el) {
        if (drag_state.target_el) drag_state.target_el.classList.remove('bpmn-drop-target')
        gfx.classList.add('bpmn-drop-target')
        drag_state.target_el = gfx
      }
    }

    const on_drop = (e) => {
      if (!drag_state.source_id) return
      const target = find_target_element(e.clientX, e.clientY)
      if (!target || target.id === drag_state.source_id) return
      e.preventDefault()
      modify_request.value = {
        source_activity_id: drag_state.source_id,
        source_activity_instance_ids: drag_state.source_instance_ids,
        target_activity_id: target.id,
        target_activity_name: target.businessObject?.name || target.id,
        scope: drag_state.source_instance_ids.length > 1 ? 'all' : 'all',
        picked_instance_id: null,
      }
    }

    if (mode === 'definition') {
      containerEl.addEventListener('click', on_action_click)
    } else if (mode === 'instance') {
      containerEl.addEventListener('dragstart', on_drag_start)
      containerEl.addEventListener('dragend', on_drag_end)
      containerEl.addEventListener('dragover', on_drag_over)
      containerEl.addEventListener('drop', on_drop)
    }

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

      tokens?.forEach(({ id, instances, incidents, activity_instance_ids }) => {
        const element = elementRegistry.get(id)
        if (!element) return
        const is_call_activity = element.type === 'bpmn:CallActivity'

        if (mode === 'instance') {
          const ids_attr = (activity_instance_ids ?? []).join(',')
          overlays.add(id, {
            position: { bottom: 0, left: 0 },
            html: `<div class="bpmn-token-dot" draggable="true" data-activity-id="${id}" data-activity-instance-ids="${ids_attr}" title="${t('bpmn.modify.drag-hint')}">${instances > 1 ? `<span class="bpmn-token-count">${instances}</span>` : ''}</div>`,
          })
          const gfx = elementRegistry.getGraphics(id)
          if (gfx) gfx.classList.add('bpmn-token-host')
          return
        }

        // definition mode
        if (incidents?.length > 0) {
          overlays.add(id, {
            position: { top: -10, left: -10 },
            html: `<div class="bpmn-badge bpmn-badge-incident">${incidents.length}</div>`,
          })
        }

        let actions_html = `<button class="bpmn-badge bpmn-badge-running bpmn-action-btn" data-action="instances" data-activity-id="${id}" title="${t('bpmn.show-instances')}">${instances}</button>`

        if (incidents?.length > 0) {
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

      if (mode === 'definition') {
        // Click on element body still filters instances
        eventBus.on('element.click', (event) => {
          const token = tokens?.find((t) => t.id === event.element.id)
          if (!token) return
          void engine_rest.process_instance.by_activity_ids(state, definition_id, [token.id])
        })
      }
    }

    void load()

    return () => {
      if (mode === 'definition') {
        containerEl.removeEventListener('click', on_action_click)
      } else if (mode === 'instance') {
        containerEl.removeEventListener('dragstart', on_drag_start)
        containerEl.removeEventListener('dragend', on_drag_end)
        containerEl.removeEventListener('dragover', on_drag_over)
        containerEl.removeEventListener('drop', on_drop)
      }
      viewer.destroy()
      viewerRef.current = null
    }
  }, [container, definition_id, xml, mode, tokens])

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

  return (
    <>
      {createPortal(controls, containerEl)}
      {mode === 'instance' && (
        <ModifyInstanceDialog
          request={modify_request}
          instance_id={instance_id}
          definition_id={definition_id}
        />
      )}
    </>
  )
}

const ModifyInstanceDialog = ({ request, instance_id, definition_id }) => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    dialogRef = useRef(null),
    error_signal = state.api.process.instance.modification

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (request.value && !dialog.open) dialog.showModal()
    if (!request.value && dialog.open) dialog.close()
  }, [request.value])

  if (!request.value) return <dialog ref={dialogRef} class="modify-instance-dialog" />

  const {
    source_activity_id,
    source_activity_instance_ids,
    target_activity_id,
    target_activity_name,
    scope,
    picked_instance_id,
  } = request.value

  const has_multiple = source_activity_instance_ids.length > 1
  const cancel_ids =
    has_multiple && scope === 'one' && picked_instance_id
      ? [picked_instance_id]
      : source_activity_instance_ids

  const body = {
    skipCustomListeners: false,
    skipIoMappings: false,
    instructions: [
      ...cancel_ids.map((aid) => ({
        type: 'cancel',
        activityInstanceId: aid,
      })),
      { type: 'startBeforeActivity', activityId: target_activity_id },
    ],
  }

  const close_dialog = () => {
    request.value = null
    error_signal.value = null
  }

  const update_request = (patch) => {
    request.value = { ...request.value, ...patch }
  }

  const submit = async () => {
    await engine_rest.process_instance.modify(state, instance_id, body)
    if (
      state.api.process.instance.modification.value?.status ===
      RESPONSE_STATE.SUCCESS
    ) {
      close_dialog()
      // refresh diagram-relevant signals
      void engine_rest.process_instance.activity_instances(state, instance_id)
      void engine_rest.process_instance.one(state, instance_id)
      if (definition_id) {
        void engine_rest.process_definition.statistics(state, definition_id)
      }
    }
  }

  const copy_payload = () => {
    void navigator.clipboard.writeText(JSON.stringify(body, null, 2))
  }

  const error =
    error_signal.value?.status === RESPONSE_STATE.ERROR
      ? error_signal.value.error
      : null
  const error_message =
    error?.message || error?.type || (error ? t('bpmn.modify.error') : null)

  return (
    <dialog ref={dialogRef} class="modify-instance-dialog">
      <h2>{t('bpmn.modify.title')}</h2>
      <dl>
        <dt>{t('bpmn.modify.source')}</dt>
        <dd>
          <code>{source_activity_id}</code>
        </dd>
        <dt>{t('bpmn.modify.target')}</dt>
        <dd>
          <code>{target_activity_name}</code>
        </dd>
      </dl>

      {has_multiple && (
        <fieldset>
          <legend>{t('bpmn.modify.scope-legend')}</legend>
          <label>
            <input
              type="radio"
              name="scope"
              checked={scope === 'all'}
              onChange={() =>
                update_request({ scope: 'all', picked_instance_id: null })
              }
            />
            {t('bpmn.modify.all-instances', { count: source_activity_instance_ids.length })}
          </label>
          <label>
            <input
              type="radio"
              name="scope"
              checked={scope === 'one'}
              onChange={() =>
                update_request({
                  scope: 'one',
                  picked_instance_id: source_activity_instance_ids[0],
                })
              }
            />
            {t('bpmn.modify.single-instance')}
          </label>
          {scope === 'one' && (
            <select
              value={picked_instance_id}
              onChange={(e) =>
                update_request({ picked_instance_id: e.currentTarget.value })
              }
            >
              {source_activity_instance_ids.map((aid) => (
                <option key={aid} value={aid}>
                  {aid}
                </option>
              ))}
            </select>
          )}
        </fieldset>
      )}

      <details>
        <summary>{t('bpmn.modify.payload-summary')}</summary>
        <pre class="modify-payload">{JSON.stringify(body, null, 2)}</pre>
      </details>

      {error_message && <p class="error">{error_message}</p>}

      <div class="button-group">
        <button type="button" onClick={copy_payload}>
          {t('bpmn.modify.copy-payload')}
        </button>
        <button type="button" onClick={close_dialog}>
          {t('common.cancel')}
        </button>
        <button type="button" class="primary" onClick={submit}>
          {t('bpmn.modify.confirm')}
        </button>
      </div>
    </dialog>
  )
}
