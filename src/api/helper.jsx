/**
 * api.js
 *
 * Provides endpoints to the default Operaton REST API.
 *
 * Please refer to the `docs/Coding Conventions.md` "JavaScript > api.js" to
 * learn how we organize the code in this file.
 */
export const _url_server = (state) => `${state.server.value.url}`;
export const _url_engine_rest = (state) =>
  `${state.server.value.url}/engine-rest`;

export const get_credentials = (state) =>
  `${state.auth.credentials.username}:${state.auth.credentials.password}`;

let headers = new Headers();
headers.set("credentials", "include");
let headers_form_urlencoded = headers;
headers_form_urlencoded.set(
  "Content-Type",
  "application/x-www-form-urlencoded;charset=UTF-8",
);

/* helpers */

// fixme: hide when get_tasks is solved better
export const RESPONSE_STATE = {
  NOT_INITIALIZED: "NOT_INITIALIZED",
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  ERROR: "ERROR",
};

/**
 * Displays the result (SUCCESS, ERROR) of an api request and all other states (LOADING, NOT_INITIALIZED, NULL)
 *
 * @param signal {preact.Signal || Array<preact.Signal>} the state signal where the result is stored
 * @param on_success {function: JSXInternal.Element} the element that is shown when the result state is SUCCESS
 * @param on_error {function: JSXInternal.Element} (optional) the element that is shown when the result state is ERROR
 * @param on_nothing (optional) the element that is shown when the state is null
 * @param on_load (optional) the element shown when the request is loading
 * @returns {JSXInternal.Element}
 */

//
//
export const RequestState = ({
  signal,
  on_success,
  on_error = null,
  on_nothing = null,
  on_load = null,
}) => {
  const is_array = Array.isArray(signal),
    is_not_null = is_array
      ? !signal.some((sig) => sig.value === null)
      : signal.value !== null;

  if (is_not_null) {
    if (is_array) {
      if (signal.some((sig) => sig.value === null)) {
        return;
      }

      const error = signal.find(
        (sig) => sig.value.status === RESPONSE_STATE.ERROR,
      );
      if (error) {
        return resolve_signal(error, on_load, on_success, on_error);
      }

      const not_init = signal.find(
        (sig) => sig.value.status === RESPONSE_STATE.NOT_INITIALIZED,
      );
      if (not_init) {
        return resolve_signal(not_init, on_load, on_success, on_error);
      }

      const loading = signal.find(
        (sig) => sig.value.status === RESPONSE_STATE.LOADING,
      );
      if (loading) {
        return resolve_signal(loading, on_load, on_success, on_error);
      }

      return resolve_signal(signal[0], on_load, on_success, on_error);
    }
    return resolve_signal(signal, on_load, on_success, on_error);
  }
  if (on_nothing) {
    return on_nothing();
  }
  return <p class="fade-in-delayed">Fetching...</p>;
};

const resolve_signal = (signal, on_load, on_success, on_error) => {
  if (signal.value.status === RESPONSE_STATE.NOT_INITIALIZED) {
    return <p>No data requested</p>;
  }

  if (signal.value.status === RESPONSE_STATE.LOADING) {
    return on_load ? on_load : <p class="fade-in-delayed">Loading...</p>;
  }

  if (signal.value.status === RESPONSE_STATE.SUCCESS) {
    return signal.value?.data ? on_success() : <p>No data</p>;
  }

  if (signal.value.status === RESPONSE_STATE.ERROR) {
    return on_error ? (
      on_error
    ) : (
      <p class="error">
        <strong>Error:</strong>
        {signal.value.error !== undefined
          ? signal.value.error.message
          : "No error message."}
      </p>
    );
  }
};

const response_data = (response) =>
  response.ok
    ? response.status === 204
      ? Promise.resolve("No Content")
      : response.json()
    : Promise.reject(response);

export const GET = async (url, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING };

  let headers = new Headers();
  headers.set(
    "Authorization",
    `Basic ${window.btoa(unescape(encodeURIComponent(get_credentials(state))))}`,
  );

  try {
    const response = await fetch(`${_url_engine_rest(state)}${url}`, {
        headers,
      }),
      json = await (response.ok ? response.json() : Promise.reject(response));
    return (signl.value = { status: RESPONSE_STATE.SUCCESS, data: json });
  } catch (error) {
    return (signl.value = { status: RESPONSE_STATE.ERROR, error });
  }
};

export const GET_SERVER_URL = (url, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING };

  let headers = new Headers();
  headers.set(
    "Authorization",
    `Basic ${window.btoa(unescape(encodeURIComponent(get_credentials(state))))}`,
  );
  headers.set(
    "Content-Type",
    "application/x-www-form-urlencoded;charset=UTF-8",
  );

  return fetch(`${_url_server(state)}${url}`, { headers })
    .then((response) =>
      response.ok ? response.text() : Promise.reject(response),
    )
    .then(
      (text) => (signl.value = { status: RESPONSE_STATE.SUCCESS, data: text }),
    )
    .catch((error) => (signl.value = { status: RESPONSE_STATE.ERROR, error }));
};

// todo fixme: proper name for login post
export const POST_SERVER_URL = (url, body, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING };

  // headers_form_urlencoded.set(
  //   "Authorization",
  //   `Basic ${window.btoa(unescape(encodeURIComponent(get_credentials(state))))}`,
  // );

  let headers = new Headers();
  headers.set(
    "Authorization",
    `Basic ${window.btoa(unescape(encodeURIComponent(get_credentials(state))))}`,
  );
  headers.set(
    "Content-Type",
    "application/x-www-form-urlencoded;charset=UTF-8",
  );

  return fetch(`${_url_server(state)}${url}`, {
    headers: headers_form_urlencoded,
    method: "POST",
    body,
    credentials: "include",
  })
    .then(response_data)
    .then(
      (json) => (signl.value = { status: RESPONSE_STATE.SUCCESS, data: json }),
    )
    .catch(
      (error) => console.log("error:", error),

      // error.json().then(json => signl.value = { status: RESPONSE_STATE.ERROR, data: json })
    );
};

export const GET_TEXT = (url, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING };

  let headers = new Headers();
  headers.set(
    "Authorization",
    `Basic ${window.btoa(unescape(encodeURIComponent(get_credentials(state))))}`,
  );

  return fetch(`${_url_engine_rest(state)}${url}`, { headers })
    .then((response) =>
      response.ok ? response.text() : Promise.reject(response),
    )
    .then(
      (text) => (signl.value = { status: RESPONSE_STATE.SUCCESS, data: text }),
    )
    .catch((error) => (signl.value = { status: RESPONSE_STATE.ERROR, error }));
};

const fetch_with_body = async (method, url, body, state, signl) => {
  signl.value = { status: RESPONSE_STATE.LOADING };

  let headers = new Headers();
  headers.set(
    "Authorization",
    `Basic ${window.btoa(unescape(encodeURIComponent(get_credentials(state))))}`,
  );
  headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(`${_url_engine_rest(state)}${url}`, {
      headers,
      method,
      body: JSON.stringify(body),
      credentials: "include",
    });
    const json = await response_data(response);
    return (signl.value = { status: RESPONSE_STATE.SUCCESS, data: json });
  } catch (error) {
    return console.log("error:", error);
  }
};

export const POST = (url, body, state, signl) =>
  fetch_with_body("POST", url, body, state, signl);

export const PUT = (url, body, state, signl) =>
  fetch_with_body("PUT", url, body, state, signl);

export const DELETE = (url, body, state, signl) =>
  fetch_with_body("DELETE", url, body, state, signl);
