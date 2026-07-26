import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'

import type {
  THubEvent,
  TLogStream,
  TPublicService,
  TServiceLog,
  TServiceStatus,
} from '../shared/contracts.ts'
import type { TServiceDefinition } from './services.ts'

const MAX_LOG_CHARS = 300_000
const EXTERNAL_POLL_MS = 2_500
const READINESS_POLL_MS = 500
const RESTART_PORT_RELEASE_POLL_MS = 50
const RESTART_PORT_RELEASE_TIMEOUT_MS = 5_000
const STOP_GRACE_MS = 750

type TRuntimeService = {
  definition: TServiceDefinition
  status: TServiceStatus
  child: ChildProcess | null
  pid: number | null
  startedAt: number | null
  endedAt: number | null
  exitCode: number | null
  runId: string | null
  stopRequested: boolean
  logs: TServiceLog[]
  logChars: number
  logSeq: number
  readinessTimer: NodeJS.Timeout | null
}

type THubSubscriber = (event: THubEvent) => void

export type TManagedProcessTarget = {
  serviceId: string
  pid: number
  runId: string
}

export class ServiceManagerError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message)
  }
}

export class ServiceManager {
  private readonly runtimes = new Map<string, TRuntimeService>()
  private readonly subscribers = new Set<THubSubscriber>()
  private readonly externalPollTimer: NodeJS.Timeout
  private readonly devHubOrigin: string | null

  constructor(
    definitions: TServiceDefinition[],
    devHubOrigin: string | null = null,
    private readonly portProbe: (port: number) => Promise<boolean> = isPortListening,
  ) {
    this.devHubOrigin = devHubOrigin
    for (const definition of definitions) {
      this.runtimes.set(definition.id, {
        definition,
        status: definition.command ? 'stopped' : 'unavailable',
        child: null,
        pid: null,
        startedAt: null,
        endedAt: null,
        exitCode: null,
        runId: null,
        stopRequested: false,
        logs: [],
        logChars: 0,
        logSeq: 0,
        readinessTimer: null,
      })
    }

    this.externalPollTimer = setInterval(() => {
      void this.refreshExternalStates()
    }, EXTERNAL_POLL_MS)
    this.externalPollTimer.unref()
  }

  async initialize(): Promise<void> {
    await this.refreshExternalStates()
  }

  listServices(): TPublicService[] {
    return Array.from(this.runtimes.values(), (runtime) => this.toPublicService(runtime))
  }

  getLogs(id: string): TServiceLog[] {
    return [...this.getRuntime(id).logs]
  }

  listMetricTargets(): TManagedProcessTarget[] {
    return Array.from(this.runtimes.values()).flatMap((runtime) =>
      runtime.pid && runtime.runId
        ? [
            {
              serviceId: runtime.definition.id,
              pid: runtime.pid,
              runId: runtime.runId,
            },
          ]
        : [],
    )
  }

  subscribe(subscriber: THubSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  async start(id: string, reason: 'start' | 'restart' = 'start'): Promise<TPublicService> {
    const runtime = this.getRuntime(id)
    const { definition } = runtime

    if (!definition.command) {
      throw new ServiceManagerError(
        definition.unavailableReason || `${definition.name} is not startable.`,
        409,
      )
    }

    if (runtime.child || ['starting', 'running', 'stopping'].includes(runtime.status)) {
      return this.toPublicService(runtime)
    }

    if (definition.port && (await this.portProbe(definition.port))) {
      runtime.status = 'external'
      this.emitStatus(runtime)
      throw new ServiceManagerError(
        `Port ${definition.port} is already owned by an unmanaged process.`,
        409,
      )
    }

    this.resetRun(runtime)
    runtime.status = definition.port ? 'starting' : 'running'
    runtime.startedAt = Date.now()
    runtime.stopRequested = false

    if (reason === 'restart') {
      this.appendLog(
        runtime,
        'system',
        '\u001b[38;5;75mRestarting service with a fresh process…\u001b[0m\r\n',
      )
    }
    this.appendLog(
      runtime,
      'system',
      `\u001b[38;5;75m$ ${[definition.command, ...(definition.args || [])].join(' ')}\u001b[0m\r\n`,
    )

    const childEnv = { ...process.env }
    delete childEnv.NO_COLOR

    const child = spawn(definition.command, definition.args || [], {
      cwd: definition.cwd,
      env: {
        ...childEnv,
        FORCE_COLOR: '3',
        CLICOLOR_FORCE: '1',
        TERM: 'xterm-256color',
        ...(this.devHubOrigin
          ? {
              DEV_HUB_URL: this.devHubOrigin,
              NEXT_PUBLIC_DEV_HUB_URL: this.devHubOrigin,
            }
          : {}),
        ...definition.env,
      },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    runtime.child = child
    runtime.pid = child.pid ?? null
    this.emitStatus(runtime)

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => this.appendLog(runtime, 'stdout', chunk))
    child.stderr?.on('data', (chunk: string) => this.appendLog(runtime, 'stderr', chunk))

    child.on('error', (error) => this.handleSpawnError(runtime, child, error))

    child.on('exit', (code, signal) => {
      if (runtime.child !== child) return
      this.handleExit(runtime, code, signal)
    })

    if (definition.port) this.watchReadiness(runtime)
    return this.toPublicService(runtime)
  }

  async stop(id: string): Promise<TPublicService> {
    const runtime = this.getRuntime(id)

    if (runtime.status === 'external') {
      throw new ServiceManagerError(
        'Unmanaged processes must be stopped from their own terminal.',
        409,
      )
    }

    const child = runtime.child
    const pid = runtime.pid
    if (!child || !pid) return this.toPublicService(runtime)

    runtime.stopRequested = true
    runtime.status = 'stopping'
    this.emitStatus(runtime)
    this.appendLog(runtime, 'system', '\r\n\u001b[38;5;214mStopping service…\u001b[0m\r\n')

    await terminateProcessGroup(child, pid)
    return this.toPublicService(runtime)
  }

  async restart(id: string): Promise<TPublicService> {
    const runtime = this.getRuntime(id)
    if (runtime.status === 'stopping') {
      throw new ServiceManagerError(`${runtime.definition.name} is already stopping.`, 409)
    }

    await this.stop(id)
    await this.waitForPortRelease(runtime)
    return this.start(id, 'restart')
  }

  async shutdown(): Promise<void> {
    clearInterval(this.externalPollTimer)

    const running = Array.from(this.runtimes.values()).filter(
      (runtime) => runtime.child && runtime.pid,
    )
    if (running.length === 0) return

    await Promise.all(
      running.map(async (runtime) => {
        runtime.stopRequested = true
        if (runtime.child && runtime.pid) {
          await terminateProcessGroup(runtime.child, runtime.pid)
        }
      }),
    )
  }

  private getRuntime(id: string): TRuntimeService {
    const runtime = this.runtimes.get(id)
    if (!runtime) throw new ServiceManagerError(`Unknown service: ${id}`, 404)
    return runtime
  }

  private resetRun(runtime: TRuntimeService): void {
    runtime.logs = []
    runtime.logChars = 0
    runtime.logSeq = 0
    runtime.runId = `${runtime.definition.id}-${Date.now().toString(36)}`
    runtime.endedAt = null
    runtime.exitCode = null
  }

  private appendLog(runtime: TRuntimeService, stream: TLogStream, chunk: string): void {
    if (!chunk) return

    const log: TServiceLog = {
      seq: ++runtime.logSeq,
      runId: runtime.runId,
      at: Date.now(),
      stream,
      chunk,
    }

    runtime.logs.push(log)
    runtime.logChars += chunk.length

    while (runtime.logChars > MAX_LOG_CHARS && runtime.logs.length > 1) {
      const removed = runtime.logs.shift()
      if (removed) runtime.logChars -= removed.chunk.length
    }

    this.emit({
      type: 'log',
      serviceId: runtime.definition.id,
      log,
    })
  }

  private watchReadiness(runtime: TRuntimeService): void {
    if (!runtime.definition.port) return

    let checking = false
    runtime.readinessTimer = setInterval(async () => {
      if (checking || !runtime.child || runtime.status !== 'starting') return
      checking = true

      try {
        if (runtime.definition.port && (await isPortListening(runtime.definition.port))) {
          runtime.status = 'running'
          this.clearReadinessTimer(runtime)
          this.emitStatus(runtime)
        }
      } finally {
        checking = false
      }
    }, READINESS_POLL_MS)
    runtime.readinessTimer.unref()
  }

  private handleExit(runtime: TRuntimeService, code: number | null, signal: NodeJS.Signals | null) {
    this.clearReadinessTimer(runtime)
    runtime.child = null
    runtime.pid = null
    runtime.endedAt = Date.now()
    runtime.exitCode = code

    const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`
    this.appendLog(
      runtime,
      'system',
      `\r\n\u001b[${runtime.stopRequested || code === 0 ? '38;5;114' : '31'}mProcess exited with ${reason}.\u001b[0m\r\n`,
    )

    runtime.status = runtime.stopRequested || code === 0 ? 'stopped' : 'error'
    runtime.stopRequested = false
    this.emitStatus(runtime)
  }

  private handleSpawnError(runtime: TRuntimeService, child: ChildProcess, error: Error): void {
    if (runtime.child !== child) return

    this.clearReadinessTimer(runtime)
    runtime.child = null
    runtime.pid = null
    runtime.endedAt = Date.now()
    runtime.status = 'error'
    runtime.stopRequested = false
    this.appendLog(runtime, 'system', `\r\n\u001b[31m${error.message}\u001b[0m\r\n`)
    this.emitStatus(runtime)
  }

  private clearReadinessTimer(runtime: TRuntimeService): void {
    if (runtime.readinessTimer) clearInterval(runtime.readinessTimer)
    runtime.readinessTimer = null
  }

  private async waitForPortRelease(runtime: TRuntimeService): Promise<void> {
    const { port } = runtime.definition
    if (!port) return

    const deadline = Date.now() + RESTART_PORT_RELEASE_TIMEOUT_MS
    while (await this.portProbe(port)) {
      if (Date.now() >= deadline) {
        throw new ServiceManagerError(
          `${runtime.definition.name} stopped, but port ${port} did not become available for restart.`,
          409,
        )
      }

      await new Promise((resolve) => setTimeout(resolve, RESTART_PORT_RELEASE_POLL_MS))
    }
  }

  private async refreshExternalStates(): Promise<void> {
    await Promise.all(
      Array.from(this.runtimes.values(), async (runtime) => {
        if (
          runtime.child ||
          !runtime.definition.command ||
          !runtime.definition.port ||
          !['stopped', 'external'].includes(runtime.status)
        ) {
          return
        }

        const nextStatus: TServiceStatus = (await this.portProbe(runtime.definition.port))
          ? 'external'
          : 'stopped'

        if (nextStatus !== runtime.status) {
          runtime.status = nextStatus
          this.emitStatus(runtime)
        }
      }),
    )
  }

  private emitStatus(runtime: TRuntimeService): void {
    this.emit({
      type: 'status',
      service: this.toPublicService(runtime),
    })
  }

  private emit(event: THubEvent): void {
    for (const subscriber of this.subscribers) subscriber(event)
  }

  private toPublicService(runtime: TRuntimeService): TPublicService {
    const { definition } = runtime

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      group: definition.group,
      monogram: definition.monogram,
      technologies: definition.technologies ?? null,
      port: definition.port ?? null,
      url: definition.url ?? null,
      portlessName: definition.portlessName ?? null,
      portlessUrl: definition.portlessUrl ?? null,
      status: runtime.status,
      pid: runtime.pid,
      startedAt: runtime.startedAt,
      endedAt: runtime.endedAt,
      exitCode: runtime.exitCode,
      canStart: Boolean(definition.command),
      unavailableReason: definition.unavailableReason ?? null,
      metricThresholds: definition.metrics,
    }
  }
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    let settled = false

    const finish = (listening: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(listening)
    }

    socket.setTimeout(300)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function killProcessGroup(child: ChildProcess, pid: number, signal: NodeJS.Signals): void {
  try {
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-pid, signal)
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : null
    if (code !== 'ESRCH') child.kill(signal)
  }
}

async function terminateProcessGroup(child: ChildProcess, pid: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  const exited = new Promise<'exited'>((resolve) => {
    child.once('exit', () => resolve('exited'))
  })
  let graceTimer: NodeJS.Timeout | null = null
  const graceExpired = new Promise<'expired'>((resolve) => {
    graceTimer = setTimeout(() => resolve('expired'), STOP_GRACE_MS)
  })

  killProcessGroup(child, pid, 'SIGTERM')
  const outcome = await Promise.race([exited, graceExpired])
  if (graceTimer) clearTimeout(graceTimer)

  if (outcome === 'expired') {
    killProcessGroup(child, pid, 'SIGKILL')
    await exited
  }
}
