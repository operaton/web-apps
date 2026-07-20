import { useContext, useEffect } from 'preact/hooks'
import { useTranslation } from 'react-i18next'
import { AppState } from '../state.js'
import { useSignal } from '@preact/signals'
import engine_rest, { RequestState, RESPONSE_STATE } from '../api/engine_rest.jsx'
import { useRoute, useLocation } from 'preact-iso'

const EMBEDDED_APP_PREFIX = 'embedded:app:'
const FORM_JS_PREFIXES = ['camunda-forms:', 'operaton-forms:']
const FORM_JS_MIGRATION_DOCS =
  'https://docs.operaton.org/documentation/user-guide/task-forms/'

const StartProcessList = () => {
  const
    state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation()

  // Fetch in effects, not the component body — preact-iso params are
  // `undefined` when absent (never null), so guard with `!= null` (see #90).
  useEffect(() => {
    void engine_rest.process_definition.list_startable(state)
  }, [])

  useEffect(() => {
    if (params.tab != null) {
      void engine_rest.process_definition.one(state, params.tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab])

  return <div>
    <StartableProcessesList />
    {params.tab != null
      ? <StartProcessForm />
      : <p>{t("tasks.start-process.select-definition")}</p>}
  </div>
}

const StartableProcessesList = () => {
  const
    state = useContext(AppState),
    { params } = useRoute(),
    [t] = useTranslation(),
    search_term = useSignal('')

  return <div>

    <div class="row space-between p-1">
      <h2>{t("tasks.start-process.title")}</h2>

      <input
        type="text"
        class="search-input"
        id="process-popup-search-input"
        aria-label={t("tasks.start-process.search-placeholder")}
        placeholder={t("tasks.start-process.search-placeholder")}
        value={search_term.value}
        onChange={(e) => (search_term.value = e.target.value)} />
    </div>
    <table>
      <thead>
      <tr>
        <th>{t("tasks.start-process.definition-name")}</th>
        <th>{t("tasks.start-process.version")}</th>
        <th>{t("tasks.start-process.description")}</th>
        <th>{t("common.key")}</th>
      </tr>
      </thead>
      <tbody>
      <RequestState
        signal={state.api.process.definition.list}
        on_success={() =>
          <>
            {state.api.process.definition.list.value.data
              .filter((process) => {
                if (search_term.value.length === 0) {
                  return true
                }
                return process.name
                  .toLowerCase()
                  .includes(search_term.value.toLowerCase())

              })
              .map((process) => (
                <tr key={process.id}
                    aria-selected={process.id === params.tab}>
                  <td><a href={`/tasks/start/${process.id}`}>{process.name}</a></td>
                  <td>{process.version}</td>
                  <td>{process.description}</td>
                  <td>{process.key}</td>
                </tr>
              ))}
          </>} />
      </tbody>
    </table>
  </div>
}

// Flatten a server-rendered legacy start form to plain inputs and collect the
// cam-variable fields. Returns null when the payload is not a <form> (e.g. a
// form-js schema or an unsupported form type), so the caller can show a notice
// instead of crashing on `null.querySelectorAll` (see #90).
const parse_form = (form_html) => {
  const parser = new DOMParser(),
    parsed = parser.parseFromString(form_html, 'text/html'),
    form = parsed.querySelector('form')

  if (!form) return null

  const inputs = form.querySelectorAll('input'),
    selects = form.querySelectorAll('select'),
    form_groups = form.querySelectorAll('.form-group')

  const fields = [
    ...Array.from(inputs, input => ({
      variable_name: input.getAttribute('cam-variable-name'),
      type: input.getAttribute('cam-variable-type'),
      input_type: input.getAttribute('type')
    })),
    ...Array.from(selects, select => ({
      variable_name: select.getAttribute('cam-variable-name'),
      type: select.getAttribute('cam-variable-type'),
      input_type: 'select'
    })),
  ].filter((f) => f.variable_name)

  form_groups.forEach(form_group => (form.innerHTML += form_group.innerHTML))
  form.querySelectorAll('.form-group').forEach(el => el.remove())
  form.querySelectorAll('[cam-variable-name]').forEach(form_element =>
    form_element.setAttribute('name', form_element.getAttribute('cam-variable-name'))
  )
  form.querySelectorAll('select').forEach(select =>
    select.querySelectorAll('option').forEach(option => (option.value = option.innerText))
  )

  return { html: form.innerHTML, fields }
}

const StartProcessForm = () => {
  const
    state = useContext(AppState),
    { params } = useRoute(),
    { route } = useLocation(),
    [t] = useTranslation(),
    form_fields = useSignal([]),
    parsed_html = useSignal(null),
    // 'loading' | 'rendered' | 'legacy' | 'unsupported'
    form_mode = useSignal('loading')

  // When the selected definition changes, fetch its start-form metadata and
  // dispatch on the form key:
  //   - embedded: (legacy AngularJS HTML) → migration notice (see #96)
  //   - camunda-forms:/operaton-forms: (form-js) → not supported yet (see #95)
  //   - otherwise → the engine's server-rendered (generated) start form
  useEffect(() => {
    state.api.task.form.value = null
    parsed_html.value = null
    form_fields.value = []
    form_mode.value = 'loading'
    if (params.tab == null) return

    void engine_rest.process_definition.start_form(state, params.tab).then(() => {
      const start_form = state.api.process.definition.start_form.value?.data,
        form_key = start_form?.key

      if (form_key != null && form_key.startsWith('embedded:')) {
        form_mode.value = 'legacy'
        // Still issue the correct fetch per the ticket (#90/#96).
        if (form_key.startsWith(EMBEDDED_APP_PREFIX)) {
          const path = form_key.substring(EMBEDDED_APP_PREFIX.length),
            context_path = start_form.contextPath ?? ''
          void engine_rest.task.get_task_form(
            state,
            `${context_path}/${path}`.replace(/^\/+/, '')
          )
        }
      } else if (FORM_JS_PREFIXES.some((p) => form_key?.startsWith(p))) {
        form_mode.value = 'unsupported'
      } else {
        form_mode.value = 'rendered'
        void engine_rest.process_definition.rendered_start_form(
          state,
          params.tab,
          state.api.task.form
        )
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab])

  // Parse the server-rendered form once it arrives. A 404 from rendered-form
  // means the definition simply has no start form, so offer a generic start.
  const form_value = state.api.task.form.value
  useEffect(() => {
    if (form_mode.value !== 'rendered' || form_value == null) return
    if (form_value.status === RESPONSE_STATE.ERROR) {
      form_mode.value = 'no-form'
      return
    }
    if (form_value.status !== RESPONSE_STATE.SUCCESS || !form_value.data) return
    const result = parse_form(form_value.data)
    if (result == null) {
      form_mode.value = 'no-form'
    } else {
      parsed_html.value = result.html
      form_fields.value = result.fields
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_value])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const
      form = event.target,
      form_data = new FormData(form),
      to_base_64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

    const variables = {}
    await Promise.all(
      form_fields.value.map(async ({ variable_name, type, input_type }) => {
        if (input_type === 'file') {
          const file = form_data.get(variable_name),
            data_url = await to_base_64(file)
          variables[variable_name] = {
            type,
            value: data_url.split(',')[1],
            valueInfo: { filename: file.name, mimeType: file.type }
          }
        } else {
          variables[variable_name] = { type, value: form_data.get(variable_name) }
        }
      })
    )

    const payload = { variables },
      business_key = form_data.get('business_key')
    if (business_key != null && business_key !== '') {
      payload.businessKey = business_key.toString()
    }

    const result = await engine_rest.process_definition.submit_form(
      state,
      params.tab,
      payload
    )
    if (result?.status === RESPONSE_STATE.SUCCESS) route('/tasks')
  }

  return <div>
    <h2>{t("tasks.form.form-title")}</h2>
    {form_mode.value === 'legacy'
      ? <p class="info-box">
          {t("tasks.form.legacy-html-unsupported")}{" "}
          <a href={FORM_JS_MIGRATION_DOCS} target="_blank" rel="noreferrer">
            {t("tasks.form.legacy-html-migrate-link")}
          </a>
        </p>
      : form_mode.value === 'unsupported'
        ? <p class="info-box">{t("tasks.form.unsupported")}</p>
        : form_mode.value === 'no-form'
          ? <form onSubmit={handleSubmit}>
              <p class="info-box">{t("tasks.start-process.no-form")}</p>
              <label>
                {t("tasks.start-process.business-key")}
                <input type="text" name="business_key" />
              </label>
              <div class="button-group">
                <button type="submit">{t("tasks.start-process.start")}</button>
              </div>
            </form>
          : parsed_html.value != null
            ? <form onSubmit={handleSubmit}>
                {/*eslint-disable-next-line react/no-danger*/}
                <div dangerouslySetInnerHTML={{ __html: parsed_html.value }} />
                <div class="button-group">
                  <button type="submit">{t("tasks.start-process.start")}</button>
                </div>
              </form>
            : <p class="fade-in-delayed">{t("common.loading")}</p>}
  </div>
}

export { StartProcessList }
