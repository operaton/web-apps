import { useContext } from 'preact/hooks'
import { useRoute, useLocation } from 'preact-iso'
import { useTranslation } from 'react-i18next'
import engine_rest, { RequestState } from '../api/engine_rest.jsx'
import { AppState } from '../state.js'
import { Breadcrumbs } from '../components/Breadcrumbs.jsx'
import { signal, useSignal } from '@preact/signals'
import authorization from '../api/resources/authorization.js'

const AdminPage = () => {
  const
    { params: { page_id } } = useRoute(),
    { route } = useLocation(),
    state = useContext(AppState),
    [t] = useTranslation()

  if (page_id === undefined) {
    route('/admin/users')
  }
  if (page_id === 'system') {
    void engine_rest.engine.telemetry(state)
  }
  if (page_id === 'groups') {
    void engine_rest.group.all(state)
  }
  if (page_id === 'tenants') {
    void engine_rest.tenant.all(state)
  }

  const is_selected = (page) => (page_id === page) ? 'selected' : ''

  return <div id="admin-page">
    <nav>
      <ul class="list">
        <li class={is_selected('users')}><a href="/admin/users">{t("admin.users")}</a></li>
        <li class={is_selected('groups')}><a href="/admin/groups">{t("admin.groups")}</a></li>
        <li class={is_selected('tenants')}><a href="/admin/tenants">{t("admin.tenants")}</a></li>
        <li class={is_selected('authorizations')}><a href="/admin/authorizations">{t("admin.authorizations")}</a></li>
        <li class={is_selected('system')}><a href="/admin/system">{t("admin.system")}</a></li>
      </ul>
    </nav>


    {({
      users: <UserPage />,
      groups: <GroupsPage />,
      tenants: <TenantsPage />,
      authorizations: <AuthorizationsPage />,
      system: <SystemPage />,
    })[page_id] ?? <p>{t("common.select-page")}</p>}

  </div>
}

const TenantsPage = () => {
  const
    { params: { selection_id } } = useRoute()

  return (selection_id === 'new')
    ? <TenantCreate />
    : (selection_id === undefined)
      ? <TenantList />
      : <TenantDetails tenant_id={selection_id} />
}

const TenantDetails = (tenant_id) => {
  const
    state = useContext(AppState),
    [t] = useTranslation()

  void engine_rest.user.profile.get(state, tenant_id.value)
  void engine_rest.group.by_member(state, tenant_id.value)
  void engine_rest.tenant.by_member(state, tenant_id.value)

  return <div class="content fade-in">
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.tenants"), route: '/admin/tenants' },
      { name: t("admin.details") }]} />

    <h2>{t("admin.tenant.details")}</h2>

    <h3>{t("admin.tenant.information")}</h3>
    <h3>{t("admin.groups")}</h3>
    <h3>{t("admin.users")}</h3>
    <h3>{t("admin.danger-zone")}</h3>
  </div>
}

const TenantCreate = () => {
  const
    state = useContext(AppState),
    { api: { tenant: { create: tenant_create } } } = state,
    [t] = useTranslation(),
    form_tenant = signal({ profile: {}, credentials: {} })

  const set_value = (k, v) => form_tenant.value = { ...form_tenant.peek(), [k]: v.currentTarget.value }

  const on_submit = e => {
    e.preventDefault()
    console.log(tenant_create.value)
    void engine_rest.tenant.create(state, form_tenant.value)
    // e.currentTarget.reset(); // Clear the inputs to prepare for the next submission
  }

  return <div>
    <h2>{t("admin.tenant.create-title")}</h2>
    <RequestState
      signal={tenant_create}
      on_nothing={() => <></>}
      on_success={() => <p className="success">{t("admin.tenant.success-created")}</p>}
      // on_error={() => <p className="error">Error: {user_create.value.error.message}</p>}
    />

    <form onSubmit={on_submit}>
      <label for="tenant-id">{t("admin.tenant.tenant-id")}</label>
      <input id="tenant-id" type="text" onInput={(e) => set_value('id', e)} required />

      <label for="tenant-name">{t("admin.tenant.tenant-name")}</label>
      <input id="tenant-name" type="text" onInput={(e) => set_value('name', e)} required />

      <div class="button-group">
        <button type="submit">{t("admin.user.create")}</button>
        <a href="/admin/users" class="button secondary">{t("common.cancel")}</a>
      </div>
    </form>
  </div>
}

const TenantList = () => {
  const
    state = useContext(AppState),
    { api: { tenant: { list: tenants } } } = state,
    [t] = useTranslation()

  return <div>
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.tenants") }]} />
    <h2>{t("admin.tenants")}</h2>

    <a href="/admin/tenants/new" class="button">{t("admin.tenant.create")}</a>

    <RequestState
      signal={tenants}
      on_success={() => tenants.value.data.length !== 0
        ? <table class="fade-in">
          <thead>
          <tr>
            <th>{t("common.id")}</th>
            <th>{t("common.name")}</th>
          </tr>
          </thead>
          <tbody>
          {tenants.value.data.map((tenant) => (
            <tr key={tenant.id}>
              <td><a href={`/admin/tenants/${tenant.id}`}>{tenant.id}</a></td>
              <td>{tenant.name}</td>
            </tr>
          ))}
          </tbody>
        </table>
        : <p>{t("admin.tenant.no-tenants")}</p>} />
  </div>
}

const GroupsPage = () => {
  const
    state = useContext(AppState),
    { api: { group: { list: groups } } } = state,
    { params: { selection_id } } = useRoute()

  return (selection_id === 'new')
    ? <GroupCreate />
    : (selection_id === undefined)
      ? <GroupsList />
      : <GroupDetails user_id={selection_id} />
}

const GroupCreate = () => {
  // https://preactjs.com/guide/v10/forms/
  const
    state = useContext(AppState),
    { api: { group: { create: group_create } } } = state,
    [t] = useTranslation(),
    form_group = useSignal({})

  const set_value = (k, v) => form_group.value = { ...form_group.peek(), [k]: v.currentTarget.value }


  const on_submit = e => {
    e.preventDefault()
    void engine_rest.group.create(state, form_group.value)
    // e.currentTarget.reset(); // Clear the inputs to prepare for the next submission
  }

  return <div>
    <h2>{t("admin.group.create")}</h2>
    <RequestState
      signal={group_create}
      on_nothing={() => <></>}
      on_success={() => <p className="success">{t("admin.group.success-created")}</p>}
      // on_error={() => <p className="error">Error: {user_create.value.error.message}</p>}
    />

    <form onSubmit={on_submit}>
      <label for="group-id">{t("admin.group.group-id")}</label>
      <input id="group-id" type="text" onInput={(e) => set_value('id', e)} required />

      <label for="group-name"> {t("admin.group.group-name")}</label>
      <input id="group-name" type="text" onInput={(e) => set_value('groupName', e)} required />

      <label for="group-type">{t("admin.group.group-type")}</label>
      <input id="group-type" type="text" onInput={(e) => set_value('groupType', e)} required />

      <div class="button-group">
        <button type="submit">{t("admin.group.create")}</button>
        <a href="/admin/groups" class="button secondary">{t("common.cancel")}</a>
      </div>
    </form>
  </div>
}

const GroupsList = () => {
  const
    { api: { group: { list: groups } } } = useContext(AppState),
    [t] = useTranslation()

  return <div>
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.groups") }]} />
    <h2>{t("admin.groups")}</h2>
    <a href="/admin/groups/new">{t("admin.group.create")}</a>
    <RequestState
      signal={groups}
      on_success={() => groups.value !== null ? <table class="fade-in">
          <thead>
          <tr>
            <th>{t("admin.group.group-id")}</th>
            <th>{t("admin.group.group-name")}</th>
            <th>{t("admin.group.group-type")}</th>
            <th>{t("common.action")}</th>
          </tr>
          </thead>
          <tbody>
          {groups.value.data.map((group) => (
            <tr key={group.id}>
              <td><a href={`/admin/groups/${group.id}`}>{group.id}</a></td>
              <td>{group.name}</td>
              <td>{group.type}</td>
              {/*<td><a onClick={() => handle_remove_group(group.id)}>Remove</a></td>*/}
            </tr>
          ))}
          </tbody>
        </table>
        : <p>{t("admin.group.no-groups")}</p>} />
  </div>
}

const GroupDetails = (user_id) => {
  const
    state = useContext(AppState),
    [t] = useTranslation()

  void engine_rest.user.profile.get(state, user_id.value)
  void engine_rest.group.by_member(state, user_id.value)
  void engine_rest.tenant.by_member(state, user_id.value)

  return <div class="content fade-in">
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.groups"), route: '/admin/groups' },
      { name: t("admin.details") }]} />

    <h2>{t("admin.group.details")}</h2>

    <h3>{t("admin.group.profile")}</h3>
    <UserProfile />
    <UserPassword />
    <UserGroups />
    <h3>{t("admin.tenants")}</h3>
    <h3>{t("admin.danger-zone")}</h3>
  </div>
}

const SystemPage = () => {
  const { api: { engine: { telemetry } } } = useContext(AppState),
    [t] = useTranslation()

  return <div>
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.system") }]} />
    <h2>{t("admin.system")}</h2>
    <RequestState
      signal={telemetry}
      on_success={() => <pre class="fade-in">{telemetry.value !== undefined ? JSON.stringify(telemetry.value?.data, null, 2) : ''} </pre>}
    />
  </div>
}

const UserPage = () => {
  const
    state = useContext(AppState),
    { params: { selection_id } } = useRoute()

  // selection_id === undefined ? void api.get_users(state) : null
  selection_id === undefined ? void engine_rest.user.all(state) : null

  return (selection_id === 'new')
    ? <UserCreate />
    : (selection_id === undefined)
      ? <UserList />
      : <UserDetails user_id={selection_id} />
}

const UserList = () => {
  const { api: { user: { list: users } } } = useContext(AppState),
    [t] = useTranslation()

  return <div className="content">
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.users") }]} />
    <h2>{t("admin.users")}</h2>
    <a href="/admin/users/new">{t("admin.user.create")}</a>
    <table class="fade-in">
      <thead>
      <tr>
        <th>{t("common.id")}</th>
        <th>{t("admin.user.first-name")}</th>
        <th>{t("admin.user.last-name")}</th>
        <th>{t("admin.user.email")}</th>
      </tr>
      </thead>
      <tbody>
      <RequestState
        signal={users}
        on_success={() => users.value?.data.map(({ id, firstName, lastName, email }) => (
          <tr key={id}>
            <td><a href={`/admin/users/${id}`}>{id}</a></td>
            <td>{firstName}</td>
            <td>{lastName}</td>
            <td>{email}</td>
          </tr>
        )) ?? <tr>
          <td>{t("admin.user.no-users")}</td>
        </tr>} />
      </tbody>
    </table>
  </div>
}

const UserDetails = (user_id) => {
  const
    state = useContext(AppState),
    [t] = useTranslation()

  void engine_rest.user.profile.get(state, user_id.value)
  void engine_rest.group.by_member(state, user_id.value)
  void engine_rest.tenant.by_member(state, user_id.value)

  return <div class="content fade-in">
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.users"), route: '/admin/users' },
      { name: t("admin.details") }]} />

    <h2>{t("admin.user.details")}</h2>

    <h3>{t("admin.group.profile")}</h3>
    <UserProfile />
    <UserPassword />
    <UserGroups />
    <h3>{t("admin.tenants")}</h3>
    <h3>{t("admin.danger-zone")}</h3>
  </div>
}

const UserGroups = () => {
  const { api: { user: { group: { list: user_groups } } } } = useContext(AppState),
    [t] = useTranslation()

  return <>
    <h3>{t("admin.groups")}</h3>
    <RequestState
      signal={user_groups}
      on_success={() =>
        <table>
          <caption class="screen-hidden">{t("admin.group.user-groups")}</caption>
          <thead>
          <tr>
            <th>{t("common.id")}</th>
            <th>{t("common.name")}</th>
            <th>{t("common.type")}</th>
            <th>{t("common.action")}</th>
          </tr>
          </thead>
          <tbody>
          {user_groups.value.data.map(group => <tr key={group.id}>
            <td>{group.id}</td>
            <td>{group.name}</td>
            <td>{group.type}</td>
            <td>{t("admin.user.remove-from-group")}</td>
          </tr>)}
          </tbody>
        </table>
      } />
    <button>{t("admin.user.add-to-group")}</button>
  </>
}

const UserProfile = () => {
  /** @namespace user_profile.value.data.firstName **/
  /** @namespace user_profile.value.data.lastName **/
  const
    { api: { user: { profile } } } = useContext(AppState),
    [t] = useTranslation()

  return <>{profile.value?.data
    ? <form>
      <label for="first-name">{t("admin.user.first-name")} </label>
      <input id="first-name" value={profile.value.data.firstName ?? ''} />

      <label for="last-name">{t("admin.user.last-name")}</label>
      <input id="last-name" value={profile.value.data.lastName ?? ''} />

      <label for="email">{t("admin.user.email")}</label>
      <input id="email" type="email" value={profile.value.data.email ?? ''} />


      <div class="button-group">
        <button type="submit">{t("admin.user.update-profile")}</button>
      </div>
    </form>
    : <p>{t("common.loading")}</p>
  }</>
}

const UserPassword = () => {
  const [t] = useTranslation()

  return <>
    <h3>{t("admin.user.password")}</h3>
    <form>
      <label for="new-password">{t("admin.user.new-password")}</label>
      <input id="new-password" type="password" placeholder="* * * * * * * * *" />

      <label for="new-password-repeat">{t("admin.user.new-password-repeat")}</label>
      <input id="new-password-repeat" type="password" placeholder="* * * * * * * * *" />

      <div class="button-group">
        <button type="submit">{t("admin.user.change-password")}</button>
      </div>
    </form>
  </>
}

const UserCreate = () => {
  // https://preactjs.com/guide/v10/forms/
  const
    state = useContext(AppState),
    { api: { user: { create: user_create } } } = state,
    [t] = useTranslation(),
    form_user = signal({ profile: {}, credentials: {} })

  const set_value = (k1, k2, v) => form_user.value = { ...form_user.peek(), [k1]: { ...form_user.peek()[k1], [k2]: v.currentTarget.value } }
  const set_p_value = (k, v) => set_value('profile', k, v)
  const set_c_value = (k, v) => set_value('credentials', k, v)


  const on_submit = e => {
    e.preventDefault()
    console.log(user_create.value)
    void engine_rest.user.create(state, form_user.value)
    // e.currentTarget.reset(); // Clear the inputs to prepare for the next submission
  }

  return <div>
    <h2>{t("admin.user.create")}</h2>
    <RequestState
      signal={user_create}
      on_nothing={() => <></>}
      on_success={() => <p className="success">{t("admin.user.success-created")}</p>}
      // on_error={() => <p className="error">Error: {user_create.value.error.message}</p>}
    />

    <form onSubmit={on_submit}>
      <label for="user-id">{t("admin.user.user-id")}</label>
      <input id="user-id" type="text" onInput={(e) => set_p_value('id', e)} required />

      <label for="password1">{t("admin.user.password")}</label>
      <input id="password1" type="password" onInput={(e) => set_c_value('password', e)} required />

      <label for="password2"> {t("admin.user.password-repeated")}</label>
      <input id="password2" type="password" onInput={(e) => set_c_value('password', e)} />

      <label for="first-name"> {t("admin.user.first-name")}</label>
      <input id="first-name" type="text" onInput={(e) => set_p_value('firstName', e)} required />

      <label for="last-name">{t("admin.user.last-name")}</label>
      <input id="last-name" type="text" onInput={(e) => set_p_value('lastName', e)} required />

      <label for="email">{t("admin.user.email")}</label>
      <input id="email" type="email" onInput={(e) => set_p_value('email', e)} required />

      <div class="button-group">
        <button type="submit">{t("admin.user.create")}</button>
        <a href="/admin/users" class="button secondary">{t("common.cancel")}</a>
      </div>
    </form>
  </div>
}

const AuthorizationsPage = () => {
  const
    { query: { resource_type } } = useRoute(),
    state = useContext(AppState),
    [t] = useTranslation(),
    show_create_authorization = useSignal(false)

  if (resource_type !== undefined || state.api.authorization.all.value === null) {
    void engine_rest.authorization.all(state, resource_type)
  }

  return <div>
    <Breadcrumbs paths={[
      { name: t("nav.admin"), route: '/admin' },
      { name: t("admin.authorizations") }]} />

    <div class="row">
      <ul class="list">
        {authorization_resources.map(({ nameKey, resource_type }) =>
          <li key={resource_type}>
            <a href={`/admin/authorizations?resource_type=${resource_type}`}
               onClick={() => engine_rest.authorization.all(state, resource_type)}>
              {t(nameKey)}
            </a>
          </li>)}
      </ul>
      {resource_type
        ? <div>
          <h3>
            {(resource_type !== undefined && resource_type !== null)
              ? t(authorization_resources.find(({ resource_type: resource_type_ }) => resource_type_.toString() === resource_type).nameKey)
              : ''} {t("admin.authorization.title")}
          </h3>

          <button onClick={() => show_create_authorization.value = !show_create_authorization.value}>
            {!show_create_authorization.value
              ? t("admin.authorization.create")
              : t("admin.authorization.cancel-create")}
          </button>

          <table class="fade-in">
            <thead>
            <tr>
              <th>{t("common.type")}</th>
              <th>{t("admin.authorization.user-group")}</th>
              <th>{t("admin.authorization.permissions")}</th>
              <th>{t("admin.authorization.resource-id")}</th>
              <th>{t("common.action")}</th>
            </tr>
            </thead>
            <tbody>
            {show_create_authorization.value
              ? <tr>
                <td>
                  <form id="create-authorization-form" onSubmit={null}>
                    <select>
                      <option value="gloabl">{t("admin.authorization.global")}</option>
                      <option value="allow">{t("admin.authorization.allow")}</option>
                      <option value="deny">{t("admin.authorization.deny")}</option>
                    </select>
                  </form>
                </td>
                <td>
                  <input
                    id=""
                    name=""
                    onInput={(e) => {}} />
                </td>
                <td>
                  <fieldset>
                    <legend>{t("admin.authorization.available-permissions")}</legend>
                    <label>
                      {t("common.create")}
                      <input type="checkbox" value="" />
                    </label>
                  </fieldset>
                </td>
                <td>
                  <input
                    type="text"
                    id=""
                    name=""
                    onInput={(e) => {}} />
                </td>
                <td class="button-group">
                  <button onClick={() => null}>{t("common.cancel")}</button>
                  <button form="create-authorization-form" type="submit">{t("common.save")}</button>
                </td>
              </tr>
              : ''
            }
            <RequestState
              signal={state.api.authorization.all}
              on_success={() => <AuthorizationResourceRows authorizations={state.api.authorization.all.value.data} />} />
            </tbody>
          </table>
        </div>
        : <p class="info-box">{t("admin.authorization.select-resource")}</p>}
        </div>
    </div>
    }

const AuthorizationResourceRows = ({ authorizations }) =>
  authorizations.map(AuthorizationResourceRow)

const AuthorizationResourceRow = (authorization) => {
  const
    { permissions, type, groupId, userId, resourceId, id } = authorization,
    state = useContext(AppState),
    [t] = useTranslation(),
    is_edit = useSignal(false),
    is_deleted = useSignal(false),
    form_authorization = signal(authorization),
    form_id = `authorization_edit_${id}`,
    set_value = (k, v) => form_authorization.value = { ...form_authorization.peek(), [k]: v.currentTarget.value },
    set_null = (k) => form_authorization.value = { ...form_authorization.peek(), [k]: null }


  const
    on_submit = e => {
      e.preventDefault()
      void engine_rest.authorization.update(state, id, form_authorization.value)
      // e.currentTarget.reset(); // Clear the inputs to prepare for the next submission
    },
    dialog_id = `delete_authorization_dialog_${id}`,
    show_delete_dialog = () =>
      document.getElementById(dialog_id).showModal(),
    delete_authorization = () => {
      void engine_rest.authorization.delete(state, id)
      is_deleted.value = true
      document.getElementById(dialog_id).close()
    }

  return <>{!is_deleted.value
    ? <tr key={id}>
      {!is_edit.value
        ? <>
          <td>{{ 0: t("admin.authorization.global-display"), 1: t("admin.authorization.allow-display"), 2: t("admin.authorization.deny-display") }[type]}</td>
          {/* (0=global, 1=grant, 2=revoke)*/}
          <td>{userId || groupId}</td>
          <td>{permissions.toString()}</td>
          <td>{resourceId}</td>
          <td className="button-group">
            <button onClick={() => is_edit.value = true}>{t("common.edit")}</button>

            <button onClick={() => show_delete_dialog()}>
              {t("common.delete")}
            </button>
          </td>
        </>
        : <>
          <td>{{ 0: t("admin.authorization.global-display"), 1: t("admin.authorization.allow-display"), 2: t("admin.authorization.deny-display") }[type]}</td>
          {/* (0=global, 1=grant, 2=revoke)*/}
          <td>
            <form id={form_id} onSubmit={on_submit}>
              {groupId
                ? <input name="groupId" value={groupId}
                         onInput={(e) => {
                           set_value('groupId', e)
                           set_null('userId')
                         }} />
                : <input name="userId" value={userId}
                         onInput={(e) => {
                           set_value('userId', e)
                           set_null('groupId')
                         }} />}
            </form>
          </td>
          <td>{permissions.toString()}</td>
          <td>
            <input form={form_id} name="resourceId" value={resourceId} onInput={(e) => set_value('resourceId', e)} />
          </td>
          <td class="button-group">
            <button onClick={() => is_edit.value = false}>{t("common.cancel")}</button>
            <button form={form_id} type="submit">{t("common.save")}</button>
          </td>
        </>
      }
    </tr>
    : ''
  }

    <dialog id={dialog_id}>
      {t("admin.authorization.confirm-delete")}

      <div class="button-group">
        <button class="danger" onClick={delete_authorization}>{t("common.delete")}</button>
        <button onClick={() => document.getElementById(dialog_id).close()}>{t("common.cancel")}</button>
      </div>
    </dialog>
  </>

}

const permissions = {
  READ: 0,
  UPDATE: 1,
  CREATE: 2,
  DELETE: 3,
  ACCESS: 4

  // Task Assign
  // Task Work
  // Read Variable
  // Update Variable
}

const authorization_resources = [
  { id: 'application', nameKey: 'admin.authorization-resources.application', resource_type: 0, resource_id: 'admin/cockpit/tasklist/*', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'authorization', nameKey: 'admin.authorization-resources.authorization', resource_type: 4, resource_id: 'Authorization ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'batch', nameKey: 'admin.authorization-resources.batch', resource_type: 13, resource_id: 'Batch ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'decision_definition', nameKey: 'admin.authorization-resources.decision-definition', resource_type: 10, resource_id: 'Decision Definition Key', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'decision_requirements_definition', nameKey: 'admin.authorization-resources.decision-requirements-definition', resource_type: 14, resource_id: 'Decision Requirements Definition Key', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'deployment', nameKey: 'admin.authorization-resources.deployment', resource_type: 9, resource_id: 'Deployment ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'filter', nameKey: 'admin.authorization-resources.filter', resource_type: 5, resource_id: 'Filter ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'group', nameKey: 'admin.authorization-resources.group', resource_type: 2, resource_id: 'Group ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'group_membership', nameKey: 'admin.authorization-resources.group-membership', resource_type: 3, resource_id: 'Group ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'process_definition', nameKey: 'admin.authorization-resources.process-definition', resource_type: 6, resource_id: 'Process Definition Key', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'process_instance', nameKey: 'admin.authorization-resources.process-instance', resource_type: 8, resource_id: 'Process Instance ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'task', nameKey: 'admin.authorization-resources.task', resource_type: 7, resource_id: 'Task ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'historic_task', nameKey: 'admin.authorization-resources.historic-task', resource_type: 19, resource_id: 'Historic Task ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'historic_process_instance', nameKey: 'admin.authorization-resources.historic-process-instance', resource_type: 20, resource_id: 'Historic Process Instance ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'tenant', nameKey: 'admin.authorization-resources.tenant', resource_type: 11, resource_id: 'Tenant ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'tenant_membership', nameKey: 'admin.authorization-resources.tenant-membership', resource_type: 12, resource_id: 'Tenant ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'user', nameKey: 'admin.authorization-resources.user', resource_type: 1, resource_id: 'User ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'report', nameKey: 'admin.authorization-resources.report', resource_type: 15, resource_id: 'Report ID', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'dashboard', nameKey: 'admin.authorization-resources.dashboard', resource_type: 16, resource_id: 'Dashboard', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'user_operation_log_category', nameKey: 'admin.authorization-resources.user-operation-log', resource_type: 17, resource_id: 'User Operation Log Category', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
  { id: 'system', nameKey: 'admin.authorization-resources.system', resource_type: 21, resource_id: '* resources do not support individual resource ids. You have to use them with a wildcard id (*).', permission: [permissions.READ, permissions.UPDATE, permissions.CREATE, permissions.DELETE] },
]

export { AdminPage }
