/** Runs external Free-budget estimates, fail-closed route checks and public probes. */
import { appendFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export const ACCOUNT_ID = '4e2e8db91d21e325d9b540ca7abf4d99'
export const ZONE_ID = 'bd0b41b1b0c3775bd45228dda8567d93'
const API = 'https://api.cloudflare.com/client/v4'

/** Rejects missing routes and fail-open settings; it never changes production. */
export function checkRoutes(routes) {
  const failures = []
  for (const pattern of ['groupher.com/*', 'www.groupher.com/*', 'auth.groupher.com/*']) {
    const route = routes.find((item) => item.pattern === pattern)
    const expected = pattern.startsWith('auth.') ? 'auth' : 'edge-router'
    if (!route || route.script !== expected)
      failures.push(`Missing expected route ${pattern} -> ${expected}`)
  }
  for (const route of routes.filter((item) => ['edge-router', 'auth'].includes(item.script))) {
    if (route.request_limit_fail_open !== false)
      failures.push(`Route is not explicitly fail-closed: ${route.pattern}`)
  }
  return failures
}

/** Evaluates sampled invocation estimates separately from exact billing quotas. */
export function checkUsage(daily, recent) {
  const failures = []
  const calls = daily.reduce((sum, row) => sum + row.sum.requests, 0)
  const requests = recent.reduce((sum, row) => sum + row.sum.requests, 0)
  const errors = recent.reduce((sum, row) => sum + row.sum.errors, 0)
  const cpuExceeded = recent
    .filter((row) => /exceeded.?cpu/i.test(row.dimensions.status))
    .reduce((sum, row) => sum + row.sum.requests, 0)
  if (calls >= 70_000)
    failures.push(`Daily account invocation estimate ${calls} >= 70000; check shared Free quota`)
  if (requests >= 100 && errors / requests >= 0.01)
    failures.push(
      `Account invocation error estimate ${((100 * errors) / requests).toFixed(2)}% >= 1% (${errors}/${requests}, last 30m)`,
    )
  if (cpuExceeded > 0)
    failures.push(`CPU-limit rejections detected: estimate ${cpuExceeded} in last 30m`)
  return { failures, calls, requests, errors, cpuExceeded }
}

async function jsonRequest(fetcher, path, token, body) {
  const response = await fetcher(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Cloudflare API HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.errors?.length || payload.success === false)
    throw new Error('Cloudflare API rejected the monitoring query; check token permissions/schema')
  return payload
}

/** Runs independently from the monitored account's Workers runtime and quota. */
export async function runGuard({
  token,
  routesOnly = false,
  fetcher = fetch,
  now = new Date(),
} = {}) {
  const failures = []
  const notes = []
  try {
    if (!token)
      throw new Error(
        'CLOUDFLARE_API_TOKEN is required (Account Analytics Read + Zone Workers Routes Read)',
      )
    const routes = await jsonRequest(fetcher, `/zones/${ZONE_ID}/workers/routes`, token)
    failures.push(...checkRoutes(routes.result))
    notes.push('Core routes checked for explicit request_limit_fail_open=false')
    if (!routesOnly) {
      const midnight = new Date(now)
      midnight.setUTCHours(0, 0, 0, 0)
      // No dimensions: daily sum is one account aggregate, not a per-script group.
      const query = `query Guard($account: String!, $start: Time!, $recent: Time!, $end: Time!) {
        viewer { accounts(filter: {accountTag: $account}) {
          daily: workersInvocationsAdaptive(limit: 1, filter: {datetime_geq: $start, datetime_lt: $end}) { sum { requests } }
          recent: workersInvocationsAdaptive(limit: 1000, filter: {datetime_geq: $recent, datetime_lt: $end}) {
            dimensions { status } sum { requests errors }
          }
        } }
      }`
      const payload = await jsonRequest(fetcher, '/graphql', token, {
        query,
        variables: {
          account: ACCOUNT_ID,
          start: midnight.toISOString(),
          recent: new Date(now.getTime() - 30 * 60_000).toISOString(),
          end: now.toISOString(),
        },
      })
      const account = payload.data?.viewer?.accounts?.[0]
      if (!account || !Array.isArray(account.daily) || !Array.isArray(account.recent))
        throw new Error('Missing analytics data')
      if (account.recent.length >= 1000) throw new Error('Analytics response may be truncated')
      const usage = checkUsage(account.daily, account.recent)
      failures.push(...usage.failures)
      notes.push(
        `UTC daily invocation estimate: ${usage.calls}; recent requests/errors/CPU rejects: ${usage.requests}/${usage.errors}/${usage.cpuExceeded}`,
      )
      notes.push(
        'Adaptive invocation estimates are not billing counts or guaranteed quota remaining; includes all account Workers',
      )
    }
  } catch (error) {
    failures.push(error.message)
  }

  if (!routesOnly) {
    for (const [url, status, service] of [
      ['https://groupher.com/health', 200, 'edge-router'],
      ['https://auth.groupher.com/health', 200, 'auth'],
      ['https://press.groupher.com/health', 200, 'press'],
      ['https://groupher.com/home/llms.txt', 200],
      ['https://press.groupher.com/home/llms.txt', 404],
    ]) {
      try {
        const response = await fetcher(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
        })
        if (response.status !== status)
          throw new Error(`HTTP ${response.status}, expected ${status}`)
        if (service) {
          const health = await response.json()
          if (health.service !== service || health.status !== 'ok')
            throw new Error('Invalid health payload')
        } else if (status === 404 && response.headers.get('cache-control') !== 'no-store') {
          throw new Error('Direct origin rejection must be no-store')
        }
        notes.push(`PASS ${url}`)
      } catch (error) {
        failures.push(`${url}: ${error.message}`)
      }
    }
  }
  return { failures, notes }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { failures, notes } = await runGuard({
    token: process.env.CLOUDFLARE_API_TOKEN,
    routesOnly: process.argv.includes('--routes-only'),
  })
  const report = [
    '# Press Free guard',
    ...notes.map((note) => `- ${note}`),
    ...failures.map((failure) => `- FAIL: ${failure}`),
  ].join('\n')
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
  process.exitCode = failures.length ? 1 : 0
}
