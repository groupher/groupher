import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PID_FILE = path.resolve(process.cwd(), '.playwright/mock-server.pid')

const waitForOK = async (url: string, timeoutMs = 30_000) => {
  const start = Date.now()

  // Node 24 has global fetch
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // ignore
    }

    await new Promise((r) => setTimeout(r, 200))
  }

  throw new Error(`Timeout waiting for ${url}`)
}

export default async () => {
  mkdirSync(path.dirname(PID_FILE), { recursive: true })

  const healthUrl = `http://localhost:${process.env.MOCK_GRAPHQL_PORT ?? '4001'}/health`

  try {
    const res = await fetch(healthUrl)
    if (res.ok) return
  } catch {
    // ignore
  }

  const child = spawn('yarn mock:server', {
    shell: true,
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      MOCK_GRAPHQL_PORT: process.env.MOCK_GRAPHQL_PORT ?? '4001',
      MOCK_GRAPHQL_PATH: process.env.MOCK_GRAPHQL_PATH ?? '/graphiql',
    },
  })

  if (!child.pid) throw new Error('Failed to start mock server')

  writeFileSync(PID_FILE, String(child.pid), 'utf8')

  await waitForOK(healthUrl)
}
