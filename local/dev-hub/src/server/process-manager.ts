import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'

import type {
  THubEvent,
  TLogStream,
  TPublicService,
  TServiceLog,
  TServiceStartMode,
  TServiceStartPolicy,
  TServiceStatus,
} from '../shared/contracts.ts'
import type { TServiceDefinition } from './services.ts'

const MAX_LOG_CHARS = 300_000
const EXTERNAL_POLL_MS = 2_500
const READINESS_POLL_MS = 500
const RESTART_PORT_RELEASE_POLL_MS = 50
const RESTART_PORT_RELEASE_TIMEOUT_MS = 5_000
const START_DEPENDENCY_READY_POLL_MS = 500
const START_DEPENDENCY_READY_TIMEOUT_MS = 45_000
const STOP_GRACE_MS = 750
const SELF_START_POLICY: TServiceStartPolicy = {
  defaultMode: 'self',
  requiredDependencies: [],
  optionalDependencies: [],
}

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

    const occupiedPorts = await getListeningDefinitionPorts(definition, this.portProbe)
    if (occupiedPorts.length > 0) {
      runtime.status = 'external'
      this.emitStatus(runtime)
      throw new ServiceManagerError(
        `Ports ${occupiedPorts.join(', ')} are already owned by unmanaged processes.`,
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

  async startWithMode(
    id: string,
    mode: TServiceStartMode | 'default' = 'default',
  ): Promise<TPublicService[]> {
    const resolvedMode = this.resolveStartMode(id, mode)
    const requiredIds = resolvedMode === 'self' ? [] : this.resolveRequiredStartPlan(id)
    const optionalIds =
      resolvedMode === 'related' ? this.resolveOptionalStartPlan(id, requiredIds) : []
    const touched = new Set<string>()

    await this.startServiceLayers(requiredIds, touched, {
      optional: false,
      waitForReady: true,
      includeOptionalDependencies: false,
    })

    const optionalStart = this.startServiceLayers(optionalIds, touched, {
      optional: true,
      waitForReady: false,
      includeOptionalDependencies: true,
    })

    await this.startPlannedService(id, touched, { optional: false, waitForReady: false })
    await optionalStart

    const returnOrder = [...requiredIds, ...optionalIds, id]
    return returnOrder
      .filter(
        (serviceId, index) => returnOrder.indexOf(serviceId) === index && touched.has(serviceId),
      )
      .map((serviceId) => this.toPublicService(this.getRuntime(serviceId)))
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

  private resolveStartPlan(id: string, mode: TServiceStartMode | 'default'): string[] {
    const target = this.getRuntime(id)
    const policy = normalizeStartPolicy(target.definition.startPolicy)
    const resolvedMode = mode === 'default' ? policy.defaultMode : mode
    const plan: string[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (serviceId: string, includeOptional: boolean) => {
      if (visited.has(serviceId)) return
      if (visiting.has(serviceId)) {
        throw new ServiceManagerError(`Start dependencies contain a cycle at ${serviceId}.`, 409)
      }

      const runtime = this.getRuntime(serviceId)
      const currentPolicy = normalizeStartPolicy(runtime.definition.startPolicy)
      visiting.add(serviceId)

      for (const dependencyId of currentPolicy.requiredDependencies)
        visit(dependencyId, includeOptional)
      if (includeOptional) {
        for (const dependencyId of currentPolicy.optionalDependencies)
          visit(dependencyId, includeOptional)
      }

      visiting.delete(serviceId)
      visited.add(serviceId)
      plan.push(serviceId)
    }

    if (resolvedMode === 'self') return [id]
    visit(id, resolvedMode === 'related')
    return plan
  }

  private resolveStartMode(id: string, mode: TServiceStartMode | 'default'): TServiceStartMode {
    if (mode !== 'default') return mode
    return normalizeStartPolicy(this.getRuntime(id).definition.startPolicy).defaultMode
  }

  private resolveRequiredStartPlan(id: string): string[] {
    return this.resolveStartPlan(id, 'chain').filter((serviceId) => serviceId !== id)
  }

  private resolveOptionalStartPlan(id: string, requiredIds: string[]): string[] {
    const policy = normalizeStartPolicy(this.getRuntime(id).definition.startPolicy)
    const required = new Set(requiredIds)
    const optionalIds: string[] = []

    for (const optionalId of policy.optionalDependencies) {
      for (const serviceId of this.resolveStartPlan(optionalId, 'related')) {
        if (serviceId === id || required.has(serviceId) || optionalIds.includes(serviceId)) continue
        optionalIds.push(serviceId)
      }
    }

    return optionalIds
  }

  private async startServiceLayers(
    serviceIds: string[],
    touched: Set<string>,
    options: {
      optional: boolean
      waitForReady: boolean
      includeOptionalDependencies: boolean
    },
  ): Promise<void> {
    const layers = this.buildStartLayers(serviceIds, options.includeOptionalDependencies)

    for (const layer of layers) {
      await Promise.all(
        layer.map((serviceId) =>
          this.startPlannedService(serviceId, touched, {
            optional: options.optional,
            waitForReady: options.waitForReady,
          }),
        ),
      )
    }
  }

  private buildStartLayers(serviceIds: string[], includeOptionalDependencies: boolean): string[][] {
    const remaining = new Set(serviceIds)
    const layers: string[][] = []

    while (remaining.size > 0) {
      const layer = Array.from(remaining).filter((serviceId) => {
        const policy = normalizeStartPolicy(this.getRuntime(serviceId).definition.startPolicy)
        const dependencies = [
          ...policy.requiredDependencies,
          ...(includeOptionalDependencies ? policy.optionalDependencies : []),
        ]
        return dependencies.every((dependencyId) => !remaining.has(dependencyId))
      })

      if (layer.length === 0) {
        throw new ServiceManagerError('Start dependencies contain a cycle.', 409)
      }

      layers.push(layer)
      for (const serviceId of layer) remaining.delete(serviceId)
    }

    return layers
  }

  private async startPlannedService(
    serviceId: string,
    touched: Set<string>,
    options: { optional: boolean; waitForReady: boolean },
  ): Promise<void> {
    const runtime = this.getRuntime(serviceId)

    if (await this.isRuntimeReady(runtime)) {
      touched.add(serviceId)
      return
    }

    if (!runtime.definition.command) {
      if (options.optional) return

      throw new ServiceManagerError(
        runtime.definition.unavailableReason || `${runtime.definition.name} is not startable.`,
        409,
      )
    }

    try {
      await this.start(serviceId)
    } catch (error) {
      if (
        error instanceof ServiceManagerError &&
        runtime.status === 'external' &&
        (await this.isRuntimeReady(runtime))
      ) {
        touched.add(serviceId)
        return
      }

      throw error
    }

    touched.add(serviceId)
    if (options.waitForReady) await this.waitForRuntimeReady(runtime)
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
        if (await isDefinitionReady(runtime.definition, this.portProbe)) {
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
    const ports = getDefinitionPorts(runtime.definition)
    if (ports.length === 0) return

    const deadline = Date.now() + RESTART_PORT_RELEASE_TIMEOUT_MS
    while (await anyPortListening(ports, this.portProbe)) {
      if (Date.now() >= deadline) {
        throw new ServiceManagerError(
          `${runtime.definition.name} stopped, but ports ${ports.join(', ')} did not become available for restart.`,
          409,
        )
      }

      await new Promise((resolve) => setTimeout(resolve, RESTART_PORT_RELEASE_POLL_MS))
    }
  }

  private async waitForRuntimeReady(runtime: TRuntimeService): Promise<void> {
    const deadline = Date.now() + START_DEPENDENCY_READY_TIMEOUT_MS

    while (!(await this.isRuntimeReady(runtime))) {
      if (Date.now() >= deadline) {
        throw new ServiceManagerError(
          `${runtime.definition.name} started, but did not become healthy before starting dependents.`,
          409,
        )
      }

      await new Promise((resolve) => setTimeout(resolve, START_DEPENDENCY_READY_POLL_MS))
    }
  }

  private async isRuntimeReady(runtime: TRuntimeService): Promise<boolean> {
    if (!['running', 'external'].includes(runtime.status)) return false

    return isDefinitionReady(runtime.definition, this.portProbe)
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

        const nextStatus: TServiceStatus = (await isDefinitionReady(
          runtime.definition,
          this.portProbe,
        ))
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
      appUrl: definition.appUrl ?? null,
      portlessName: definition.portlessName ?? null,
      portlessUrl: definition.portlessUrl ?? null,
      portlessAppUrl: definition.portlessAppUrl ?? null,
      endpoints: (definition.endpoints ?? []).map((endpoint) => ({
        id: endpoint.id,
        label: endpoint.label,
        port: endpoint.port ?? null,
        url: endpoint.url ?? null,
        appUrl: endpoint.appUrl ?? null,
        portlessName: endpoint.portlessName ?? null,
        portlessUrl: endpoint.portlessUrl ?? null,
        portlessAppUrl: endpoint.portlessAppUrl ?? null,
      })),
      status: runtime.status,
      pid: runtime.pid,
      startedAt: runtime.startedAt,
      endedAt: runtime.endedAt,
      exitCode: runtime.exitCode,
      canStart: Boolean(definition.command),
      unavailableReason: definition.unavailableReason ?? null,
      metricThresholds: definition.metrics,
      startPolicy: normalizeStartPolicy(definition.startPolicy),
    }
  }
}

function normalizeStartPolicy(policy: TServiceDefinition['startPolicy']): TServiceStartPolicy {
  return {
    defaultMode: policy?.defaultMode ?? SELF_START_POLICY.defaultMode,
    requiredDependencies: [
      ...(policy?.requiredDependencies ?? SELF_START_POLICY.requiredDependencies),
    ],
    optionalDependencies: [
      ...(policy?.optionalDependencies ?? SELF_START_POLICY.optionalDependencies),
    ],
  }
}

async function isHealthReady(url: string, serviceId: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
    if (!response.ok) return false

    const payload = (await response.json().catch(() => null)) as {
      schemaVersion?: unknown
      status?: unknown
      service?: unknown
    } | null

    return (
      payload?.schemaVersion === 'health.v1' &&
      payload.service === serviceId &&
      (payload.status === 'ok' || payload.status === 'limited')
    )
  } catch {
    return false
  }
}

async function isHttpReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
    return response.ok
  } catch {
    return false
  }
}

async function isDefinitionReady(
  definition: TServiceDefinition,
  portProbe: (port: number) => Promise<boolean>,
): Promise<boolean> {
  if (definition.endpoints?.length) {
    return (
      await Promise.all(
        definition.endpoints.map((endpoint) => isEndpointReady(endpoint, definition.id, portProbe)),
      )
    ).every(Boolean)
  }

  const { port, url, id } = definition
  if (definition.readiness === 'http-status' && url) return isHttpReady(url)
  if (definition.readiness === 'health-v1' && url) return isHealthReady(url, id)
  if (definition.readiness === 'port' && port) return portProbe(port)
  if (url) return isHealthReady(url, id)
  if (port) return portProbe(port)
  return true
}

async function isEndpointReady(
  endpoint: NonNullable<TServiceDefinition['endpoints']>[number],
  serviceId: string,
  portProbe: (port: number) => Promise<boolean>,
): Promise<boolean> {
  if (endpoint.url) return isHealthReady(endpoint.url, serviceId)
  if (endpoint.port) return portProbe(endpoint.port)
  return true
}

function getDefinitionPorts(definition: TServiceDefinition): number[] {
  const ports = [
    definition.port,
    ...(definition.endpoints ?? []).map((endpoint) => endpoint.port),
  ].filter((port): port is number => typeof port === 'number')

  return [...new Set(ports)]
}

async function anyPortListening(
  ports: readonly number[],
  portProbe: (port: number) => Promise<boolean>,
): Promise<boolean> {
  return (await Promise.all(ports.map((port) => portProbe(port)))).some(Boolean)
}

async function getListeningDefinitionPorts(
  definition: TServiceDefinition,
  portProbe: (port: number) => Promise<boolean>,
): Promise<number[]> {
  const ports = getDefinitionPorts(definition)
  const checks = await Promise.all(
    ports.map(async (port) => [port, await portProbe(port)] as const),
  )
  return checks.filter(([, listening]) => listening).map(([port]) => port)
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
