import {
  GET_SERVER_URL,
  POST,
  POST_SERVER_URL,
  GET,
  _url_engine_rest,
  get_auth_header,
  RESPONSE_STATE,
} from "../helper.jsx";
import {
  is_oauth,
  start_oauth_login,
  handle_oauth_callback,
  restore_oauth_session,
  oauth_logout,
} from "../oauth.js";
import user from "./user.js";

const cookies = (state) =>
  GET_SERVER_URL("/operaton/app/cockpit/default/", state, state.auth.cookies);

/**
 * Login new user
 * @param {Object} state - Application state
 * @param username User name
 * @param password Password
 */
const login = (
  state,
  /** @type {string} */ username,
  /** @type {string} */ password,
  /** @type {boolean} */ remember_login
) => {
  const login_form_data = new FormData();
  login_form_data.append("username", username);
  login_form_data.append("password", password);
  let headers = new Headers();
  headers.set(
    "Authorization",
    `Basic ${window.btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`,
  ); //TODO authentication

  fetch(`${_url_engine_rest(state)}/user`, { headers })
    .then((response) =>
      response.ok ? response.json() : Promise.reject(response),
    )
    .then((data) => {
      state.auth.credentials.value = { username, password };
      state.auth.logged_in.value = {
        status: RESPONSE_STATE.SUCCESS,
        data: "authenticated",
      };
      if (remember_login) {
        document.cookie = `credentials={"username": "${username}", "password": "${password}"};path=/`
      }
    })
    .catch(
      (error) =>
        (state.auth.logged_in.value = {
          status: RESPONSE_STATE.ERROR,
          data: "wrong_login",
        }),
    );
};
/**
 * Logout current user
 * @param {Object} state - Application state
 */
const logout = (state) =>
  POST(
    "/operaton/api/admin/auth/user/default/logout",
    null,
    state,
    state.auth.logout_response,
  );

const is_authenticated = async (state) => {
  if (is_oauth) {
    // OAuth: try to restore session from sessionStorage
    const restored = await restore_oauth_session(state)
    if (restored) return state.auth.logged_in.value
    // Check for OAuth callback (authorization code in URL)
    const handled = await handle_oauth_callback(state)
    if (handled) return state.auth.logged_in.value
    // No session, no callback — unauthenticated
    return (state.auth.logged_in.value = {
      status: RESPONSE_STATE.ERROR,
      data: "unauthenticated",
    })
  }

  // Basic auth: credentials are required — without them, show login
  const signal = state.auth.logged_in;
  if (!state.auth.credentials.value?.username) {
    return (signal.value = {
      status: RESPONSE_STATE.ERROR,
      data: "unauthenticated",
    });
  }

  signal.value = { status: RESPONSE_STATE.LOADING };
  const { username, password } = state.auth.credentials.value;

  try {
    const response = await fetch(`${_url_engine_rest(state)}/authorization`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${window.btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`,
      },
    });
    await (response.ok ? response.json() : Promise.reject(response));
    return (signal.value = {
      status: RESPONSE_STATE.SUCCESS,
      data: "authenticated",
    });
  } catch (error) {
    return (signal.value = {
      status: RESPONSE_STATE.ERROR,
      data: "unauthenticated",
    });
  }
};

const auth = {
  logout: is_oauth ? oauth_logout : logout,
  login,
  cookies,
  is_authenticated,
  start_oauth_login,
};

export default auth;
