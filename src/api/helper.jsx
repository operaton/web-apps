/**
 * api.js
 *
 * Provides endpoints to the default Operaton REST API.
 *
 * Please refer to the `docs/Coding Conventions.md` "JavaScript > api.js" to
 * learn how we organize the code in this file.
 */
export const _url = (state) => `${state.server.value.url}/engine-rest`
export const _url_forms = (state) => `${state.server.value.url}`

let headers = new Headers()
headers.set('Authorization', `Basic ${window.btoa(unescape(encodeURIComponent('demo:demo')))}`) //TODO authentication
let headers_json = headers
headers_json.set('Content-Type', 'application/json')

/* helpers */

// fixme: hide when get_tasks is solved better
export const RESPONSE_STATE = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
}

/**
 * Displays the result (SUCCESS, ERROR) of an api request and all other states (LOADING, NOT_INITIALIZED, NULL)
 *
 * @param signal {Preact.Signal} the state signal where the result is stored
 * @param on_success {function: JSXInternal.Element} the element that is shown when the result state is SUCCESS
 * @param on_error {function: JSXInternal.Element} (optional) the element that is shown when the result state is ERROR
 * @param on_nothing (optional) the element that is shown when the state is null
 * @param on_load (optional) the element shown when the request is loading
 * @returns {JSXInternal.Element}
 */
export const RequestState = ({ signal, on_success, on_error = null, on_nothing = null, on_load = null }) =>
  <>
    {(signal.value !== null)
      ? {
        NOT_INITIALIZED: <p>No data requested</p>,
        LOADING: on_load ? on_load : <p class="fade-in-delayed">Loading...</p>,
        SUCCESS: signal.value?.data ? on_success() : <p>No data</p>,
        ERROR: on_error ? on_error : <p class="error"><strong>Error:</strong> {signal.value.error !== undefined ? signal.value.error.message : 'No error message.'}</p>
      }[signal.value.status]
      : on_nothing
        ? on_nothing()
        : <p class="fade-in-delayed">Fetching...</p>
    }
  </>

const response_data = (response) =>
  response.ok
    ? (response.status === 204)
      ? Promise.resolve('No Content')
      : response.json()
    : Promise.reject(response)

export const GET = (url, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING }

  return fetch(`${_url(state)}${url}`, { headers: { "Content-Type": "application/json"}})
    .then(response => response.ok ? response.json() : Promise.reject(response))
    .then(json => signl.value = { status: RESPONSE_STATE.SUCCESS, data: json })
    .catch(error => signl.value = { status: RESPONSE_STATE.ERROR, error })
}

export const GET_FORM = (url, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING }

  return fetch(`${_url_forms(state)}${url}`)
    .then(response => response.ok ? response.text() : Promise.reject(response))
    .then(text => signl.value = { status: RESPONSE_STATE.SUCCESS, data: text })
    .catch(error => signl.value = { status: RESPONSE_STATE.ERROR, error })
}

export const GET_TEXT = (url, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING }

  return fetch(`${_url(state)}${url}`)
    .then(response => response.ok ? response.text() : Promise.reject(response))
    .then(text => signl.value = { status: RESPONSE_STATE.SUCCESS, data: text })
    .catch(error => signl.value = { status: RESPONSE_STATE.ERROR, error })
}

const fetch_with_body = (method, url, body, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING }

  return fetch(`${_url(state)}${url}`,
    {
      headers: headers_json,
      method,
      body: JSON.stringify(body)
    })
    .then(response_data)
    .then(json => signl.value = { status: RESPONSE_STATE.SUCCESS, data: json })
    .catch(error => console.log("error:", error)

      // error.json().then(json => signl.value = { status: RESPONSE_STATE.ERROR, data: json })
)
}

export const POST = (url, body, state, signl) => {
  return fetch_with_body('POST', url, body, state, signl)
}

export const PUT = (url, body, state, signl) =>
  fetch_with_body('PUT', url, body, state, signl)

export const DELETE = (url, body, state, signl) =>
  fetch_with_body('DELETE', url, body, state, signl)
