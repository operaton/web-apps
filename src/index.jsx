import { render } from 'preact'
import { LocationProvider, Route, Router } from 'preact-iso'
import { AppState, createAppState } from './state.js'

import { Header } from './components/Header.jsx'
import { GoTo } from './components/GoTo.jsx'

import { Home } from './pages/Home.jsx'
import { TasksPage } from './pages/Tasks.jsx'
import { ProcessesPage } from './pages/Processes.jsx'
import { AdminPage } from './pages/Admin.jsx'
import { DeploymentsPage } from './pages/Deployments.jsx'
import { NotFound } from './pages/_404.jsx'
import { AccountPage } from './pages/Account.jsx'

import './css/fonts.css'
import './css/form.css'
import './css/variables.css'
import './css/layout.css'
import './css/components.css'
import './css/normalize.css'
import './css/animation.css'
import { StartProcessList } from './pages/StartProcessList.jsx'
import { DecisionsPage } from './pages/Decisions.jsx'

'use strict'

export function App () {
  return (
    <AppState.Provider value={createAppState()}>
      <LocationProvider>
        <Header />
        <Router>
          <Route path="/" component={Home} />
          <Route path="/decisions" component={DecisionsPage} />
          <Route path="/decisions/:decision_id" component={DecisionsPage} />
          <Route path="/tasks" component={TasksPage} />
          {/*<Route path="/tasks/start/:id" component={TasksPage} />*/}
          <Route path="/tasks/:task_id" component={TasksPage} />
          <Route path="/tasks/:task_id/:tab" component={TasksPage} />
          <Route path="/processes" component={ProcessesPage} />
          <Route path="/processes/:definition_id" component={ProcessesPage} />
          <Route path="/processes/:definition_id/:panel" component={ProcessesPage} />
          <Route path="/processes/:definition_id/:panel/:selection_id" component={ProcessesPage} />
          <Route path="/processes/:definition_id/:panel/:selection_id/:sub_panel" component={ProcessesPage} />
          <Route path="/deployments" component={DeploymentsPage} />
          <Route path="/deployments/:deployment_id" component={DeploymentsPage} />
          <Route path="/deployments/:deployment_id/:resource_name" component={DeploymentsPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/admin/:page_id" component={AdminPage} />
          <Route path="/admin/:page_id/:selection_id" component={AdminPage} />
          <Route path="/account" component={AccountPage} />
          <Route path="/account/:page_id" component={AccountPage} />
          <Route path="/account/:page_id/:selection_id" component={AccountPage} />
          <Route default component={NotFound} />
        </Router>
        <GoTo />
      </LocationProvider>
    </AppState.Provider>
  )
}

render(<App />, document.getElementById('app'))
