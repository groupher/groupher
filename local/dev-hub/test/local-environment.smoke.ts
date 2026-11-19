import { runHubCommand } from '../src/server/cli.ts'
import { LOCAL_SERVICE_ENDPOINTS } from '../src/server/service-endpoints.ts'

type TServiceStatus = { id: string; status: string }

const report = (
  service: string,
  check: string,
  result: 'passed' | 'failed' | 'not-run',
  reason = '',
) => {
  console.log(`${service}: ${check}: ${result}${reason ? ` (${reason})` : ''}`)
}

const main = async () => {
  let services: TServiceStatus[]
  try {
    services = (await runHubCommand(['status'])) as TServiceStatus[]
    report('Dev Hub', 'worktree identity and API', 'passed')
  } catch (error) {
    report('Dev Hub', 'worktree identity and API', 'failed', String(error))
    process.exitCode = 1
    return
  }

  const byId = new Map(services.map((service) => [service.id, service.status]))
  let canProbe = true
  for (const id of ['auth', 'phoenix', 'assets-read-worker']) {
    const status = byId.get(id)
    if (status === 'running') {
      report(id, 'Hub-managed listener', 'passed')
    } else {
      report(id, 'Hub-managed listener', 'not-run', `service status is ${status || 'missing'}`)
      canProbe = false
    }
  }

  if (!canProbe) {
    process.exitCode = 1
    return
  }

  try {
    const response = await fetch(`${LOCAL_SERVICE_ENDPOINTS.assetsReadWorker}/health/ready`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      report(
        'Assets Worker -> Auth -> Phoenix',
        'service identity capability probe',
        'failed',
        `HTTP ${response.status}`,
      )
      process.exitCode = 1
      return
    }
    const health = (await response.json()) as {
      checks?: Array<{ name?: string; status?: string }>
      status?: string
    }
    if (
      health.status !== 'ok' ||
      !health.checks?.some((check) => check.name === 'assets-service-auth' && check.status === 'ok')
    ) {
      report('Assets Worker -> Auth -> Phoenix', 'service identity capability probe', 'failed')
      process.exitCode = 1
      return
    }
    report('Assets Worker -> Auth -> Phoenix', 'service identity capability probe', 'passed')
  } catch (error) {
    report('Auth -> Phoenix', 'service identity capability probe', 'failed', String(error))
    process.exitCode = 1
  }
}

await main()
