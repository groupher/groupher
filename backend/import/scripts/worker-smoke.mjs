/**
 * Starts the Content Import Worker in cf dev and verifies its HTTP boundary.
 *
 * cf dev -> workerd Worker -> health and authorization assertions
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const server = createServer()
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const address = server.address()
if (!address || typeof address === 'string') throw new Error('worker_smoke_port_unavailable')
await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))

const baseUrl = `http://127.0.0.1:${address.port}`
const child = spawn('cf', ['dev', '--mode', 'development', '--port', `${address.port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.setEncoding('utf8').on('data', (chunk) => (output += chunk))
child.stderr.setEncoding('utf8').on('data', (chunk) => (output += chunk))

const stop = async () => {
  if (child.exitCode !== null || child.killed) return
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

try {
  let health
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`cf_dev_exited_${child.exitCode}\n${output}`)
    try {
      health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1_000) })
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  if (!health) throw new Error(`cf_dev_start_timeout\n${output}`)
  const healthBody = await health.json()
  if (
    health.status !== 200 ||
    healthBody.service !== 'import' ||
    healthBody.environment !== 'development'
  ) {
    throw new Error(`worker_health_invalid:${JSON.stringify(healthBody)}`)
  }

  const unauthorized = await fetch(`${baseUrl}/api/docs/import/previews?community=home`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  if (unauthorized.status !== 401) {
    throw new Error(`worker_auth_route_expected_401_got_${unauthorized.status}`)
  }
  console.log('Import workerd smoke passed: /health and unauthenticated preview rejection.')
} finally {
  await stop()
}
