import { RequestState as request_state } from './helper.jsx'
import auth from './resources/auth.js'
import engine from './resources/engine.js'
import user from './resources/user.js'
import group from './resources/group.js'
import tenant from './resources/tenant.js'
import process_definition from './resources/process_definition.js'
import process_instance from './resources/process_instance.js'
import deployment from './resources/deployment.js'
import history from './resources/history.js'
import job_definition from './resources/job_definition.js'
import task from './resources/task.js'
import authorization from './resources/authorization.js'

const engine_rest = {
  auth,
  authorization,
  engine,
  user,
  group,
  tenant,
  process_definition,
  process_instance,
  deployment,
  history,
  job_definition,
  task
}

export default engine_rest

export const RequestState = request_state