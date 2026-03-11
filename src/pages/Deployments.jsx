import { useContext } from 'preact/hooks'
import { AppState } from '../state.js'
import { useLocation, useRoute } from 'preact-iso'
import engine_rest, { RequestState } from '../api/engine_rest.jsx'
import { BPMNViewer } from '../components/BPMNViewer.jsx'
import { DmnViewer } from '../components/DMNViewer.jsx'
import { formatRelativeDate } from '../helper/date_formatter.js'

const DeploymentsPage = () => {
  const state = useContext(AppState),
    { deployments_page: { selected_resource } } = state,
    { params: { deployment_id, resource_name } } = useRoute(),
    { route } = useLocation(),
    no_deployments_loaded = state.api.deployment.all.value === null || state.api.deployment.all.value === undefined,
    no_resources_loaded = state.api.deployment.resources.value === null && deployment_id

  if (no_deployments_loaded) {
    void engine_rest.deployment.all(state)
      .then(() => {
        if (deployment_id === undefined) {
          route(`/deployments/${state.api.deployment.all.value.data[0].id}`)
        }
      })
  }

  if (no_resources_loaded) {
    void engine_rest.deployment.resources(state, deployment_id)
      .then(() => {
          selected_resource.value = state.api.deployment.resources.value.data.find((resource) => resource.name === resource_name)
        }
      )
  }

  if (resource_name && state.api.deployment.resources.value?.data && !selected_resource.value) {
    selected_resource.value = state.api.deployment.resources.value.data.find(
      (r) => r.name === resource_name
    )
  }

  if (resource_name && selected_resource.value) {
    void engine_rest.deployment.resource(state, deployment_id, selected_resource.value.id)
  }

  if (resource_name && selected_resource.value !== null) {
    void engine_rest.process_definition.by_deployment_id(state, deployment_id, resource_name)
    void engine_rest.process_instance.count(state, deployment_id)
  }

  return (
    <main id="content" class="deployments fade-in">
      <div id="deployment-lists">
        <DeploymentsList />
        <ResourcesList />
      </div>
      {resource_name
        ? <ResourceDetails />
        : <div class="deployment-empty">Select a deployment and resource to show details.</div>}
    </main>
  )
}

const DeploymentsList = () => {
  const
    state = useContext(AppState),
    { deployments_page: { selected_resource, selected_deployment, selected_process_statistics } } = state,
    { params } = useRoute(),
    reset_state = (deployment_id) => {
      void engine_rest.deployment.resources(state, deployment_id)
        .then(() => {
            selected_resource.value = state.api.deployment.resources.value.data.find((res) => res.id === params.resource_name)
          }
        )

      state.api.process.definition.one.value = null
      state.api.process.instance.count.value = null
      selected_resource.value = null
      selected_deployment.value = null
      selected_process_statistics.value = null
    }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Deployed</th>
          </tr>
        </thead>
        <tbody>
          <RequestState
            signal={state.api.deployment.all}
            on_success={() =>
              state.api.deployment.all.value?.data.map((deployment) => (
                <tr key={deployment.id} aria-selected={params.deployment_id === deployment.id}>
                  <th scope="row">
                    <a href={`/deployments/${deployment.id}`} onClick={() => reset_state(deployment.id)}>
                      {deployment?.name || deployment?.id}
                    </a>
                  </th>
                  <td>
                    <time datetime={deployment.deploymentTime}>
                      {formatRelativeDate(deployment.deploymentTime)}
                    </time>
                  </td>
                </tr>
              ))
            } />
        </tbody>
      </table>
    </div>
  )
}

const ResourcesList = () => {
  const
    state = useContext(AppState),
    { params } = useRoute()

  if (!params.deployment_id) {
    return <div class="deployment-empty">Select a deployment to show its resources.</div>
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Resource</th>
          </tr>
        </thead>
        <tbody>
          <RequestState
            signal={state.api.deployment.resources}
            on_success={() =>
              state.api.deployment.resources.value?.data.map((resource) => (
                <tr key={resource.id} aria-selected={params.resource_name === resource.name}>
                  <th scope="row">
                    <a href={`/deployments/${params.deployment_id}/${resource.name}`}>
                      {resource.name.includes('/')
                        ? resource.name.split('/').pop().trim()
                        : resource.name || 'N/A'}
                    </a>
                  </th>
                </tr>
              ))
            } />
        </tbody>
      </table>
    </div>
  )
}

const ResourceDetails = () => {
  const
    state = useContext(AppState),
    {
      api: {
        process: {
          definition: { one: process_definition },
          instance: { count: instance_count }
        },
        deployment: { resource }
      }
    } = state,
    { params: { resource_name } } = useRoute(),
    resource_file_type = resource_name?.split('.').pop()

  return (
    <div class="process-details">
      <RequestState
        signal={resource}
        on_nothing={() => <p class="info-box">No resource selected</p>}
        on_success={() => <>
          {process_definition.value?.data?.length > 0
            ? <div>
                <h3>{process_definition.value?.data[0].name || 'N/A - Process name is not defined'}</h3>
                <p class={process_definition.value?.data[0].suspended ? 'status-suspended' : 'status-active'}>
                  {process_definition.value?.data[0].suspended ? 'Suspended' : 'Active'}
                </p>
                <dl>
                  <dt>Name</dt>
                  <dd>{process_definition.value?.data[0].name || '?'}</dd>
                  <dt>Key</dt>
                  <dd>{process_definition.value?.data[0].key || '?'}</dd>
                  <dt>Instance Count</dt>
                  <dd>
                    <RequestState
                      signal={instance_count}
                      on_success={() => instance_count.value?.data.count}
                    />
                  </dd>
                </dl>
              </div>
            : <p>Empty response</p>}
        </>} />
      <div id="diagram-container" />
      <RequestState
        signal={resource}
        on_success={() =>
          resource.value.data !== null
            ? {
                bpmn: <BPMNViewer xml={resource.value.data} container={'diagram-container'} />,
                dmn: <DmnViewer xml={resource.value.data} container={'#diagram-container'} />
              }[resource_file_type]
            : null
        } />
    </div>
  )
}

export { DeploymentsPage }
