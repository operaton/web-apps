import { useEffect, useRef } from 'preact/hooks'
import { Form } from '@bpmn-io/form-js-viewer'
import '@bpmn-io/form-js-viewer/dist/assets/form-js-base.css'
import '@bpmn-io/form-js-viewer/dist/assets/form-js.css'

/**
 * Renders a Camunda Forms (form-js) schema. Submission is invoked imperatively
 * by the parent via the `controlsRef` it can read from `on_ready`.
 *
 * @param schema     form-js JSON schema (object)
 * @param data       initial form data ({ key: value })
 * @param disabled   true → render read-only
 * @param on_submit  ({ data, errors }) => void — fired after a successful submit
 * @param on_ready   (controls) => void — exposes { submit() } once form is mounted
 */
export const CamundaForm = ({ schema, data, disabled, on_submit, on_ready }) => {
  const container_ref = useRef(null)
  const form_ref = useRef(null)

  useEffect(() => {
    if (!container_ref.current || !schema) return

    const form = new Form({ container: container_ref.current })
    form_ref.current = form

    form.on('submit', (e) => on_submit?.(e))

    void form.importSchema(schema, data ?? {}).catch((err) => {
      console.error('form-js importSchema failed', err)
    })

    if (on_ready) on_ready({ submit: () => form.submit() })

    return () => {
      form.destroy()
      form_ref.current = null
    }
    // We intentionally re-mount when the schema changes; data updates are
    // handled below to keep keystrokes from rebooting the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema])

  useEffect(() => {
    const form = form_ref.current
    if (!form || data === undefined) return
    try { form._update?.({ data }) } catch { /* ignore */ }
  }, [data])

  useEffect(() => {
    const form = form_ref.current
    if (!form) return
    try {
      form.setProperty?.('readOnly', !!disabled)
    } catch { /* older form-js: best-effort */ }
  }, [disabled])

  return <div ref={container_ref} class="camunda-form" />
}
