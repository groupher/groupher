import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { REPO_ROOT, SERVICE_DEFINITIONS, type TServiceDefinition } from './services.ts'

type TAlias = { hostname: string; port: number }
type TRoute = TAlias & { pid: number; url: string; upstream?: unknown }
type TPortlessControls = {
  run: (args: string[]) => Promise<string>
  probe: (ca?: string) => Promise<boolean>
  readCA: (stateDir: string) => Promise<string>
}

export class PortlessError extends Error {
  readonly statusCode = 409
}

/** Generate static aliases from the same definitions used to start services. */
export function buildPortlessAliases(definitions: TServiceDefinition[]): TAlias[] {
  const aliases = new Map<string, number>()
  for (const definition of definitions) {
    for (const endpoint of [definition, ...(definition.endpoints ?? [])]) {
      if (!endpoint.portlessUrl || !endpoint.port) continue
      const url = new URL(endpoint.portlessUrl)
      if (url.protocol !== 'https:' || url.port || !url.hostname.endsWith('.localhost')) {
        throw new PortlessError(`Invalid canonical Portless URL: ${endpoint.portlessUrl}`)
      }
      const port = endpoint.port
      const existing = aliases.get(url.hostname)
      if (existing !== undefined && existing !== port) {
        throw new PortlessError(`Conflicting Portless ports for ${url.hostname}.`)
      }
      aliases.set(url.hostname, port)
    }
  }
  return Array.from(aliases, ([hostname, port]) => ({ hostname, port }))
}

/** Use the repository pin, never a global CLI or an on-demand package download. */
export function runPortless(args: string[]): Promise<string> {
  const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('portless')))
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PORTLESS_PORT: '443',
        PORTLESS_HTTPS: '1',
        PORTLESS_TLD: 'localhost',
        PORTLESS_LAN: '0',
        // Only explicit setup may write hosts; routine startup stays unprivileged.
        ...(process.platform === 'darwin' ? { PORTLESS_SYNC_HOSTS: '0' } : {}),
      },
      stdio: [process.stdin.isTTY ? 'inherit' : 'ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    })
    let output = ''
    let errors = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (errors += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(output)
      else reject(new Error(`portless ${args.join(' ')} failed: ${errors || output || code}`))
    })
  })
}

/** Identify the daemon, then optionally verify TLS with its OS-trusted CA. */
export function probePortless(ca?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = https.request(
      {
        hostname: '127.0.0.1',
        servername: 'groupher.localhost',
        port: 443,
        path: '/',
        method: 'HEAD',
        headers: { host: 'groupher.localhost' },
        rejectUnauthorized: ca !== undefined,
        ...(ca ? { ca } : {}),
        timeout: 1_500,
      },
      (response) => {
        response.resume()
        resolve(response.headers['x-portless'] === '1')
      },
    )
    request.on('error', () => resolve(false))
    request.on('timeout', () => request.destroy())
    request.end()
  })
}

/** Ensure on demand; never install a startup service or fall back to another port. */
export class PortlessManager {
  private pending: Promise<void> | null = null

  constructor(
    private readonly definitions = SERVICE_DEFINITIONS,
    private readonly controls: TPortlessControls = {
      run: runPortless,
      probe: probePortless,
      readCA: (stateDir) => readFile(path.join(stateDir, 'ca.pem'), 'utf8'),
    },
  ) {}

  ensure(initialize = false): Promise<void> {
    if (this.pending) return this.pending
    this.pending = this.prepare(initialize)
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error)
        throw new PortlessError(
          `Portless is not ready: ${reason}\nRun pnpm portless:setup in a terminal if certificate trust or sudo is required. Do not change ports or disable HTTPS.`,
        )
      })
      .finally(() => {
        this.pending = null
      })
    return this.pending
  }

  private async prepare(initialize: boolean): Promise<void> {
    const aliases = buildPortlessAliases(this.definitions)
    if (!(await this.controls.probe())) {
      await this.controls.run([
        'proxy',
        'start',
        '--https',
        '--port',
        '443',
        '--tld',
        'localhost',
        ...(process.platform === 'darwin' ? ['--unprivileged'] : []),
      ])
    }
    if (!(await this.controls.probe()))
      throw new Error('HTTPS proxy is not responding on port 443.')
    if (initialize) await this.controls.run(['trust'])
    const doctor = JSON.parse(await this.controls.run(['doctor', '--json'])) as {
      stateDir: string
      proxyTarget: string
      mode: string
      findings: Array<{ status: string; message: string; hint?: string }>
    }
    if (doctor.proxyTarget !== 'https://127.0.0.1' || doctor.mode !== 'HTTPS, .localhost') {
      throw new Error(`Unexpected proxy configuration: ${doctor.proxyTarget}, ${doctor.mode}.`)
    }
    if (doctor.findings.some(({ hint }) => hint === 'Run: portless trust')) {
      throw new Error('The local CA is not trusted. Run pnpm portless:setup once in a terminal.')
    }
    const ca = await this.controls.readCA(doctor.stateDir)
    if (!(await this.controls.probe(ca)))
      throw new Error('Portless HTTPS certificate check failed.')

    const current = await this.routes()
    // Refuse process-owned routes before changing any aliases. --force could
    // terminate another worktree's process, so it is deliberately never used.
    for (const alias of aliases) {
      const route = current.find((item) => item.hostname === alias.hostname)
      if (route && route.pid !== 0)
        throw new Error(`${alias.hostname} is owned by PID ${route.pid}.`)
    }
    for (const alias of aliases) {
      const route = current.find((item) => item.hostname === alias.hostname)
      if (!route || route.port !== alias.port || route.upstream !== undefined) {
        await this.controls.run(['alias', alias.hostname, String(alias.port), '--tld', 'localhost'])
      }
    }
    const synced = await this.routes()
    for (const alias of aliases) {
      const route = synced.find((item) => item.hostname === alias.hostname)
      if (
        !route ||
        route.pid !== 0 ||
        route.port !== alias.port ||
        route.upstream !== undefined ||
        route.url !== `https://${alias.hostname}`
      ) {
        throw new Error(`Canonical alias verification failed for ${alias.hostname}.`)
      }
    }
    if (initialize) await this.controls.run(['hosts', 'sync'])
  }

  private async routes(): Promise<TRoute[]> {
    return (JSON.parse(await this.controls.run(['list', '--json'])) as { routes: TRoute[] }).routes
  }
}
