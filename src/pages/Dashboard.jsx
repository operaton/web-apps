import { useContext } from "preact/hooks"
import engine_rest, { RequestState } from "../api/engine_rest.jsx"
import { AppState } from "../state.js"

export const DashboardPage = () => {
  const state = useContext(AppState)

  if (state.api.task.list.value === null)
    void engine_rest.task.get_tasks(state)
  if (state.api.process.definition.list.value === null)
    void engine_rest.process_definition.list(state)
  if (state.api.deployment.all.value === null)
    void engine_rest.deployment.all(state)
  if (state.api.decision.definitions.value === null)
    void engine_rest.decision.get_decision_definitions(state)

  return (
    <main id="content" class="dashboard fade-in">
      <h2>Hello{(state.auth.user.id.value ?? state.auth.credentials.value?.username) ? `, ${state.auth.user.id.value ?? state.auth.credentials.value?.username}` : ""}</h2>
      <div class="dashboard-cards">
        <DashboardCard
          title="Tasks"
          href="/tasks"
          signal={state.api.task.list}
          render={(data) => {
            const tasks = data ?? []
            return (
              <>
                <span class="dashboard-count">{tasks.length}</span>
                <span>open tasks</span>
              </>
            )
          }}
        />
        <DashboardCard
          title="Processes"
          href="/processes"
          signal={state.api.process.definition.list}
          render={(data) => {
            const definitions = data ?? []
            const incidents = definitions.reduce(
              (sum, d) => sum + (d.incidents?.length ?? 0), 0
            )
            return (
              <>
                <span class="dashboard-count">{definitions.length}</span>
                <span>deployed definitions</span>
                {incidents > 0 && (
                  <span class="dashboard-incidents">{incidents} incident{incidents !== 1 && "s"}</span>
                )}
              </>
            )
          }}
        />
        <DashboardCard
          title="Decisions"
          href="/decisions"
          signal={state.api.decision.definitions}
          render={(data) => {
            const decisions = data ?? []
            return (
              <>
                <span class="dashboard-count">{decisions.length}</span>
                <span>decision definitions</span>
              </>
            )
          }}
        />
        <DashboardCard
          title="Deployments"
          href="/deployments"
          signal={state.api.deployment.all}
          render={(data) => {
            const deployments = data ?? []
            return (
              <>
                <span class="dashboard-count">{deployments.length}</span>
                <span>deployments</span>
              </>
            )
          }}
        />
      </div>

      <section class="dashboard-section">
        <h3>Open Incidents</h3>
        <RequestState
          signal={state.api.process.definition.list}
          on_success={() => {
            const definitions = state.api.process.definition.list.value?.data ?? [],
              incidents = definitions.flatMap((d) =>
                (d.incidents ?? []).map((i) => ({ ...i, processName: d.definition?.name ?? d.definition?.key }))
              )
            if (incidents.length === 0) return <p>No incidents</p>
            return (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Process</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.incidentType ?? "–"}</td>
                      <td><a href={`/processes/${i.processDefinitionId ?? ""}`}>{i.processName ?? "–"}</a></td>
                      <td>{i.incidentCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }}
        />
      </section>

      <section class="dashboard-section">
        <header>
          <h3>Recent Tasks</h3>
          <a href="/tasks" class="dashboard-see-more">See all tasks</a>
        </header>
        <RequestState
          signal={state.api.task.list}
          on_success={() => {
            const tasks = state.api.task.list.value?.data ?? []
            if (tasks.length === 0) return <p>No open tasks.</p>
            return (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Assignee</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 10).map((task) => (
                    <tr key={task.id}>
                      <td><a href={`/tasks/${task.id}`}>{task.name ?? "Unnamed"}</a></td>
                      <td>{task.assignee ?? "–"}</td>
                      <td>{task.created ? new Date(task.created).toLocaleDateString() : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }}
        />
      </section>

      <section class="dashboard-section">
        <header>
          <h3>Process Definitions</h3>
          <a href="/processes" class="dashboard-see-more">See all processes</a>
        </header>
        <RequestState
          signal={state.api.process.definition.list}
          on_success={() => {
            const definitions = state.api.process.definition.list.value?.data ?? []
            if (definitions.length === 0) return <p>No process definitions.</p>
            return (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Key</th>
                    <th>Instances</th>
                    <th>Incidents</th>
                  </tr>
                </thead>
                <tbody>
                  {definitions.slice(0, 10).map((d) => (
                    <tr key={d.id}>
                      <td><a href={`/processes/${d.id}`}>{d.definition?.name ?? d.definition?.key ?? "–"}</a></td>
                      <td>{d.definition?.key ?? "–"}</td>
                      <td>{d.instances ?? 0}</td>
                      <td>{d.incidents?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }}
        />
      </section>
    </main>
  )
}

const DashboardCard = ({ title, href, signal, render }) => (
  <a href={href} class="dashboard-card">
    <h3>{title}</h3>
    <RequestState
      signal={signal}
      on_success={() => render(signal.value?.data)}
    />
  </a>
)
