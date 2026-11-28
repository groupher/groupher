import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { REPO_ROOT, SERVICE_DEFINITIONS, type TServiceDefinition } from './services.ts'
import { registryRoot } from './storage-paths.ts'

type TAlias = { hostname: string; port: number }
type TRoute = TAlias & { pid: number; url: string; upstream?: unknown }
type TPortlessControls = {
  run: (args: string[]) => Promise<string>
  probe: (ca?: string) => Promise<boolean>
  readCA: (stateDir: string) => Promise<string>
  probeAlias?: (hostname: string, ca: string) => Promise<boolean>
}

export class PortlessError extends Error {
  readonly statusCode = 409
}

/** Serialize shared Portless route changes across independently running Hubs. */
export async function withPortlessLock<T>(directory: string, action: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const lock = path.join(directory, 'portless.lock')
  const token = randomUUID()
  const deadline = Date.now() + 10_000
  while (true) {
    try {
      await mkdir(lock, { mode: 0o700 })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (Date.now() >= deadline)
        throw new Error('Portless route lock is held; inspect its owner before recovery.')
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  try {
    await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, token }), {
      flag: 'wx',
      mode: 0o600,
    })
    return await action()
  } finally {
    const owner = await readFile(path.join(lock, 'owner.json'), 'utf8').catch(() => '')
    if (owner === JSON.stringify({ pid: process.pid, token }))
      await rm(lock, { recursive: true, force: true })
  }
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

/** Verify local name resolution and TLS for the actual sibling hostname. */
export async function probePortlessAlias(hostname: string, ca: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true })
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => address !== '127.0.0.1' && address !== '::1')
    )
      return false
    return await new Promise((resolve) => {
      const request = https.request(
        {
          hostname: '127.0.0.1',
          servername: hostname,
          port: 443,
          path: '/',
          method: 'HEAD',
          headers: { host: hostname },
          rejectUnauthorized: true,
          ca,
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
  } catch {
    return false
  }
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
    private readonly lockDirectory = registryRoot(),
    private readonly verifyAliasHosts = false,
  ) {}

  ensure(initialize = false): Promise<void> {
    if (this.pending) return this.pending
    this.pending = withPortlessLock(this.lockDirectory, () => this.prepare(initialize))
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

  /** Remove only static aliases that still point to this instance's reserved ports. */
  async removeOwnedAliases(): Promise<void> {
    await withPortlessLock(this.lockDirectory, async () => {
      const aliases = buildPortlessAliases(this.definitions)
      const current = await this.routes()
      for (const alias of aliases) {
        const route = current.find((item) => item.hostname === alias.hostname)
        if (
          route &&
          (route.pid !== 0 ||
            route.port !== alias.port ||
            route.upstream !== undefined ||
            route.url !== `https://${alias.hostname}`)
        )
          throw new Error(`Refusing to remove an alias with changed ownership: ${alias.hostname}.`)
      }
      for (const alias of aliases) {
        if (current.some((item) => item.hostname === alias.hostname))
          await this.controls.run(['alias', '--remove', alias.hostname, '--tld', 'localhost'])
      }
      const remaining = await this.routes()
      if (aliases.some((alias) => remaining.some((item) => item.hostname === alias.hostname)))
        throw new Error('One or more owned Portless aliases could not be removed.')
    })
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
    if (this.verifyAliasHosts) {
      const probe = this.controls.probeAlias || probePortlessAlias
      const results = await Promise.all(aliases.map((alias) => probe(alias.hostname, ca)))
      const badIndex = results.findIndex((valid) => !valid)
      if (badIndex >= 0)
        throw new Error(`Local DNS or TLS verification failed for ${aliases[badIndex].hostname}.`)
    }
    if (initialize) await this.controls.run(['hosts', 'sync'])
  }

  private async routes(): Promise<TRoute[]> {
    return (JSON.parse(await this.controls.run(['list', '--json'])) as { routes: TRoute[] }).routes
  }
}
