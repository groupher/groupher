import { startControlOnly } from './control-only-server.ts'
import { REPO_ROOT } from './services.ts'
import { registryRoot } from './storage-paths.ts'

const instanceId = process.env.DEV_HUB_INSTANCE_ID || ''
const port = Number(process.env.DEV_HUB_PORT)
const server = await startControlOnly(REPO_ROOT, registryRoot(), instanceId, port)
process.on('SIGINT', () => server.close())
process.on('SIGTERM', () => server.close())
