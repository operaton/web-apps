import { useContext } from 'preact/hooks'
import { AppState } from '../state.js'
import { signal, useSignal } from '@preact/signals'
import engine_rest, { RequestState } from '../api/engine_rest.jsx'
import { useRoute } from 'preact-iso'

const StartProcessList = () => {
  const
    state = useContext(AppState),
    { params } = useRoute(),
    start_processID = signal(null),
    display_start_formular = signal(false)

  void engine_rest.process_definition.list_startable(state)

  if (params.id !== null) {
    void engine_rest.process_definition.start_form(state, params.id)
  }

  const display_process_form = async (state, process_id) => {
    start_processID.value = process_id
    formFields.value = []

    try {
      const response = await engine_rest.process_definition.rendered_start_form(state, process_id)
      rendered_form = response.data

      // Parse the HTML string so querySelectors work
      const parser = new DOMParser()
      const htmlDoc = parser.parseFromString(rendered_form, 'text/html')

      const group = htmlDoc.querySelector('.form-group')

      const label = group.querySelector('label')?.textContent?.trim()
      const select = group.querySelector('select')
      const input = group.querySelector('input')

      let select_name = ''
      let cam_variable_name_ = ''
      let cam_variable_type_ = ''
      let value = ''
      let select_options = []
      let input_type = ''

      if (select) {
        cam_variable_type_ = 'Select'
        select_name = select.getAttribute('name')
        cam_variable_name_ = select.getAttribute('cam-variable-name')
        const options = select.querySelectorAll('option')
        select_options = Array.from(options).map(option => option.getAttribute('value'))
      } else if (input) {
        cam_variable_type_ = input.getAttribute('cam-variable-type')
        cam_variable_name_ = input.getAttribute('cam-variable-name')
        value = input.getAttribute('value')
        input_type = input.getAttribute('type')
      } else {
        console.error('Unknown form field type in rendered form!')
        return
      }

      formFields.value.push({
        name: select_name,
        cam_variable_name: cam_variable_name_,
        cam_variable_type: cam_variable_type_,
        label,
        value,
        select_options,
        type: input_type
      })
      console.log('Debugging', formFields)

    } catch (error) {
      console.error('Fehler beim Abrufen der rendered_form,', error)
    }

    display_start_formular.value = !display_start_formular.value
  }

  return <main id="start-task">
    <header>
      <a href="/tasks">Back</a>
      <h1>Start process</h1>
    </header>

    <div class="row">
      <StartableProcessesList />
      {params.id !== null
        ? <StartProcessForm />
        : <p>Select a process definition</p>}
    </div>
  </main>
}

const StartableProcessesList = () => {
  const
    state = useContext(AppState),
    { params } = useRoute(),
    search_term = useSignal('')

  return <div>
    <input
      type="text"
      className="search-input"
      id="process-popup-search-input"
      placeholder="Search by process name."
      value={search_term.value}
      onChange={(e) => (search_term.value = e.target.value)} />
    <ul class="list">

      <RequestState signl={state.api.process.definition.list}
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
                            <li key={process.id}>
                              <a href={`/tasks/start/${process.id}`}
                                 class={(process.id === params.id) ? 'selected' : ''}>{process.name}</a>
                            </li>
                          ))}
                      </>} />
    </ul>
  </div>
}

const StartProcessForm = () => {
  const
    state = useContext(AppState),
    { params } = useRoute(),
    request_body_submit_form = useSignal({
      variables: {},
      business_key: 'myBusinessKey'
    }),
    formFields = useSignal([])

  const handleSubmit = async (event) => {
    const confirmStart = window.confirm(`Are you sure you want to start the process?`)
    if (!confirmStart) return
    event.preventDefault()

    const form = event.target
    const form_data = new FormData(form)

    formFields.value.forEach(field => {

      let variable_type
      let variable_value
      let variable_name = field.name

      if (field.cam_variable_type === 'Select') {
        variable_value = form_data.get(variable_name)
        variable_type = 'String'
      } else if (field.type === 'checkbox') {
        variable_type = 'Boolean'
        const input = form.querySelector(`[name="${variable_name}"]`)
        variable_value = input.checked
      } else {
        variable_type = 'String'
        variable_value = field.value
      }

      request_body_submit_form.variables[variable_name] = {
        value: variable_value,
        type: variable_type
      }
    })

    request_body_submit_form.business_key = form_data.get('business_key')?.toString()

    void engine_rest.process_definition.submit_form(state, params.id, request_body_submit_form)
  }

  return <div>
    <h2>Form</h2>
    <div className="popup-body" id="form-popup-body">
      <form onSubmit={handleSubmit}>
        {/* Form fields section */}
        {formFields.value.length > 0 && (
          <div>
            {formFields.value.map(field => (
              <div className="form-group" key={field.name}>
                <label htmlFor={field.name}>{field.label}</label>

                {field.cam_variable_type === 'Select' ? (
                  <select
                    className="form-control"
                    name={field.name}
                    cam-variable-type={field.cam_variable_type}
                    cam-variable-name={field.cam_variable_name}
                  >
                    {field.select_options.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-control"
                    name={field.name}
                    cam-variable-type={field.cam_variable_type_}
                    cam-variable-name={field.cam_variable_name_}
                    type={field.type}
                    {...(field.type === 'checkbox'
                        ? {
                          checked: field.value === 'true',
                          onInput: (e) => field.value = e.target.checked.toString()
                        }
                        : {
                          value: field.value ?? '',
                          onInput: (e) => field.value = e.target.value
                        }
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="form-group">
          <label htmlFor="business_key">Business Key:</label>
          <input className="form-control" id="business_key" name="business_key" />
        </div>

        <button type="submit">Start Process</button>
      </form>
    </div>
  </div>
}

export { StartProcessList }
