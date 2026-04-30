import { useState, useContext, useEffect, useRef } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import { AppState } from '../state.js'
import engine_rest, { RequestState } from '../api/engine_rest.jsx'
import * as Icons from '../assets/icons.jsx'
import { useRoute, useLocation } from 'preact-iso'
import { CamundaForm } from '../components/CamundaForm.jsx'

const TaskForm = () => {
  const
    state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation(),
    selectedTask = state.api.task.one.value?.data,
    refName = state.server.value.c7_mode ? 'camundaFormRef' : 'operatonFormRef'

  if (!selectedTask) return <p class="info-box">{t("tasks.form.no-task-selected")}</p>

  const formKey = selectedTask.formKey ?? ''
  const has_camunda_form_ref = !!selectedTask[refName]
  const is_camunda_form_via_key =
    formKey.startsWith('camunda-forms:') || formKey.startsWith('operaton-forms:')
  const is_embedded_html_form = formKey.startsWith('embedded:')

  // Camunda Forms (form-js) — either by formRef or by camunda-forms:* formKey.
  if (has_camunda_form_ref || is_camunda_form_via_key) {
    return <CamundaTaskForm task={selectedTask} taskId={params.task_id} />
  }

  // Legacy: embedded HTML form (looked up via task.form). Kept as-is for back-compat.
  if (is_embedded_html_form) {
    return <EmbeddedHtmlTaskForm task={selectedTask} formKey={formKey} />
  }

  // No form configured — render auto-generated form for variables.
  return <RenderedFallbackForm task={selectedTask} taskId={params.task_id} />
}

// ---- Camunda Forms (form-js) ------------------------------------------------

const CamundaTaskForm = ({ task, taskId }) => {
  const state = useContext(AppState),
    { route } = useLocation(),
    [t] = useTranslation(),
    [error, setError] = useState(null),
    submit_ref = useRef(null)

  useEffect(() => {
    void engine_rest.task.get_task_deployed_form(state, task.id)
    void engine_rest.task.get_task_form_variables(state, task.id)
  }, [task.id])

  const deployed = state.api.task.deployed_form.value
  const variables = state.api.task.form_variables.value

  const schema = deployed?.data
  const vars = variables?.data
  if (!schema || typeof schema !== 'object' || !Array.isArray(schema.components)) {
    if (deployed?.status === 'ERROR') {
      return <p class="error">{t('tasks.form.fetch-failed')}: {deployed.error?.message}</p>
    }
    return <p class="fade-in-delayed">{t('common.loading')}</p>
  }
  if (!vars) return <p class="fade-in-delayed">{t('common.loading')}</p>

  const initial_data = vars_to_form_data(vars)

  const on_submit = ({ data, errors }) => {
    if (errors && Object.keys(errors).length > 0) {
      setError(t('tasks.form.validation-error') ?? 'Validation error')
      return
    }
    setError(null)
    const payload = form_data_to_vars(data, vars)
    engine_rest.task.post_task_form(state, taskId, payload)
      .then(() => {
        localStorage.removeItem(`task_form_${taskId}`)
        route('/tasks')
      })
      .catch((e) => setError(e?.message ?? 'Submit failed'))
  }

  return (
    <div class="task-form camunda-task-form">
      <CamundaForm
        schema={schema}
        data={initial_data}
        on_submit={on_submit}
        on_ready={(c) => { submit_ref.current = c.submit }}
      />
      {error && <p class="error">{error}</p>}
      <div class="form-buttons">
        <button type="button" onClick={() => submit_ref.current?.()}>
          {t('tasks.form.complete-task')}
        </button>
      </div>
    </div>
  )
}

const vars_to_form_data = (vars) => {
  const out = {}
  for (const [k, entry] of Object.entries(vars ?? {})) {
    out[k] = entry?.value
  }
  return out
}

const form_data_to_vars = (data, originalVars) => {
  const out = {}
  for (const [k, value] of Object.entries(data ?? {})) {
    const original = originalVars?.[k]
    out[k] = { value, type: original?.type ?? infer_type(value) }
  }
  return out
}

const infer_type = (v) => {
  if (typeof v === 'boolean') return 'Boolean'
  if (typeof v === 'number') return Number.isInteger(v) ? 'Long' : 'Double'
  if (Array.isArray(v) || (v && typeof v === 'object')) return 'Json'
  return 'String'
}

// ---- Legacy embedded HTML form ----------------------------------------------

const EmbeddedHtmlTaskForm = ({ task, formKey }) => {
  const state = useContext(AppState),
    [t] = useTranslation()

  if (!state.api.task.form.value) {
    void engine_rest.task.get_task_form(state, formKey.substring(13))
  }

  return (
    <RequestState
      signal={state.api.task.form}
      on_success={() =>
        // eslint-disable-next-line react/no-danger
        <div dangerouslySetInnerHTML={{ __html: state.api.task.form.value.data }} />}
    />
  )
}

// ---- Auto-generated fallback (no form configured) ---------------------------

const RenderedFallbackForm = ({ task, taskId }) => {
  const state = useContext(AppState),
    [t] = useTranslation(),
    [generated, setGenerated] = useState(''),
    [error, setError] = useState(null)

  if (!state.api.task.rendered_form.value) {
    void engine_rest.task.get_task_rendered_form(state, task.id)
  }
  const rendered_form = state.api.task.rendered_form.value
  if (rendered_form?.data && generated === '') {
    setGenerated(parse_html(state, rendered_form.data))
  }

  return (
    <>
      <div style="margin-bottom: 8px;">{t("tasks.form.required-field")}</div>
      <div id="generated-form" class="task-form">
        <form onSubmit={(e) => submit_legacy_form(e, state, setError, taskId)}>
          <div class="form-fields" dangerouslySetInnerHTML={{ __html: generated }} />
          <div class={`error ${error ? 'show' : 'hidden'}`}>
            <span class="icon"><Icons.exclamation_triangle /></span>
            <span class="error-text">{error}</span>
          </div>
          <div class="form-buttons">
            <button type="submit">{t("tasks.form.complete-task")}</button>
            <button type="button" class="secondary" onClick={() => store_data(state)}>{t("tasks.form.save-form")}</button>
          </div>
        </form>
      </div>
    </>
  )
}

const parse_html = (state, html) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const form = doc.getElementsByTagName('form')[0]

  if (!form) return '<p class="info-box">No form available for this task.</p>'

  const disable = state.api.user?.profile?.value?.id !== state.api.task.value?.data.assignee
  let storedData = localStorage.getItem(`task_form_${state.api.task.one.value?.data.id}`)
  if (storedData) storedData = JSON.parse(storedData)

  const inputs = form.getElementsByTagName('input')
  const selects = form.getElementsByTagName('select')

  for (const field of inputs) {
    if (!field.getAttribute('name')) field.name = 'name'
    if (field.hasAttribute('uib-datepicker-popup')) field.type = 'date'
    if (field.getAttribute('cam-variable-type') === 'Long') field.type = 'number'
    if (disable) field.setAttribute('disabled', 'disabled')
    if (field.hasAttribute('required')) {
      const prevElement = field.previousElementSibling
      const parentLabel = field.closest('label')
      if (prevElement && prevElement.tagName === 'LABEL' && !prevElement.textContent.includes('*')) {
        prevElement.textContent += '*'
      } else if (parentLabel && !parentLabel.textContent.includes('*')) {
        parentLabel.textContent += '*'
      }
    }
    if (storedData) {
      if (field.type === 'checkbox' && storedData[field.name]?.value) field.checked = true
      else if (storedData[field.name]) field.value = storedData[field.name].value
    }
  }
  for (const field of selects) {
    if (disable) field.setAttribute('disabled', 'disabled')
    if (storedData?.[field.name]) {
      for (const option of field.children) {
        if (option.value === storedData[field.name].value) option.selected = true
      }
    }
  }
  return DOMPurify.sanitize(form.innerHTML, { ADD_ATTR: ['cam-variable-type'] })
}

const submit_legacy_form = (e, state, setError, taskId) => {
  e.preventDefault()
  setError(null)
  const data = build_legacy_form_data()
  engine_rest.task.post_task_form(state, taskId, data)
    .then(() => {
      localStorage.removeItem(`task_form_${taskId}`)
      window.location.href = '/tasks'
    })
    .catch((error) => {
      console.error('Submit failed:', error)
      setError(error?.message || 'An unknown error occurred.')
    })
}

const store_data = (state) => {
  localStorage.setItem(
    `task_form_${state.api.task.one.value?.data?.id}`,
    JSON.stringify(build_legacy_form_data(true)),
  )
}

const build_legacy_form_data = (temporary = false) => {
  const inputs = document.getElementById('generated-form').getElementsByClassName('form-control')
  const data = {}
  for (let input of inputs) {
    const name = input.name
    if (!name) continue
    switch (input.type) {
      case 'checkbox':
        data[name] = { value: input.checked }; break
      case 'date': {
        if (input.value) {
          const val = temporary ? input.value : input.value.split('-').reverse().join('/')
          data[name] = { value: val }
        }
        break
      }
      case 'number':
        if (input.value) data[name] = { value: parseInt(input.value, 10) }
        break
      default:
        if (input.value) data[name] = { value: input.value }
    }
  }
  return data
}

export { TaskForm }
