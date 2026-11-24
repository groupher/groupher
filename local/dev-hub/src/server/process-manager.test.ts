import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { localWorkerEnvironmentPaths } from './local-environment.ts'
import { ServiceManager, ServiceManagerError } from './process-manager.ts'
import { ServiceEnvironmentStore } from './service-environment.ts'
import type { TServiceDefinition } from './services.ts'

const FIXTURE_SERVICE: TServiceDefinition = {
  id: 'stop-fixture',
  name: 'Stop Fixture',
  description: 'Long-running process used to verify graceful stops.',
  group: 'backend',
  monogram: 'SF',
  cwd: process.cwd(),
  command: process.execPath,
  args: [
    '-e',
    "process.on('SIGTERM', () => { console.log('SIGTERM received'); setTimeout(() => process.exit(0), 25) }); console.log('READY'); setInterval(() => {}, 1_000)",
  ],
  metrics: {
    serverCpuPercent: 100,
    serverRssBytes: 1024 ** 3,
    browserBusyPercent: 50,
    browserHeapBytes: 512 * 1024 ** 2,
  },
}

const STUBBORN_FIXTURE_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'stubborn-stop-fixture',
  name: 'Stubborn Stop Fixture',
  description: 'Long-running process used to verify forced-stop fallback.',
  args: [
    '-e',
    "process.on('SIGTERM', () => {}); console.log('READY'); setInterval(() => {}, 1_000)",
  ],
}

const PORT_FIXTURE_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'restart-port-fixture',
  name: 'Restart Port Fixture',
  description: 'Managed process used to verify restart port-release polling.',
  port: 65_534,
}

const EXTERNAL_FIXTURE_SERVICE: TServiceDefinition = {
  ...PORT_FIXTURE_SERVICE,
  id: 'external-restart-fixture',
  name: 'External Restart Fixture',
  config: {
    kind: 'env-files',
    root: process.cwd(),
    environment: 'development',
  },
}

const CHAIN_DEPENDENCY_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'chain-dependency',
  name: 'Chain Dependency',
  description: 'Required service used to verify start chains.',
}

const OPTIONAL_DEPENDENCY_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'optional-dependency',
  name: 'Optional Dependency',
  description: 'Optional service used to verify related starts.',
}

const CHAIN_TARGET_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'chain-target',
  name: 'Chain Target',
  description: 'Service with a configured start chain.',
  startPolicy: {
    defaultMode: 'chain',
    requiredDependencies: [CHAIN_DEPENDENCY_SERVICE.id],
    optionalDependencies: [OPTIONAL_DEPENDENCY_SERVICE.id],
  },
}

const CONTRACT_TARGET_SERVICE: TServiceDefinition = {
  ...CHAIN_TARGET_SERVICE,
  id: 'contract-target',
  name: 'Contract Target',
  startupChecks: [
    {
      healthCheckName: 'phoenix-service-auth',
      id: 'service-auth-contract',
      label: 'Auth to Phoenix Service Identity contract',
      url: 'http://127.0.0.1:3004/health/service-auth',
    },
  ],
}

const ADOPTED_TARGET_SERVICE: TServiceDefinition = {
  ...EXTERNAL_FIXTURE_SERVICE,
  id: 'adopted-target',
  name: 'Adopted Target',
  startPolicy: {
    defaultMode: 'chain',
    requiredDependencies: [CHAIN_DEPENDENCY_SERVICE.id],
    optionalDependencies: [],
  },
}

const PARALLEL_DEPENDENCY_A: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'parallel-dependency-a',
  name: 'Parallel Dependency A',
  description: 'First required dependency used to verify parallel starts.',
  port: 65_501,
}

const PARALLEL_DEPENDENCY_B: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'parallel-dependency-b',
  name: 'Parallel Dependency B',
  description: 'Second required dependency used to verify parallel starts.',
  port: 65_502,
}

const PARALLEL_TARGET_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'parallel-target',
  name: 'Parallel Target',
  description: 'Service with multiple required dependencies.',
  startPolicy: {
    defaultMode: 'chain',
    requiredDependencies: [PARALLEL_DEPENDENCY_A.id, PARALLEL_DEPENDENCY_B.id],
    optionalDependencies: [],
  },
}

const SLOW_OPTIONAL_DEPENDENCY: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'slow-optional-dependency',
  name: 'Slow Optional Dependency',
  description: 'Optional dependency that may keep warming after the target starts.',
  port: 65_503,
}

const OPTIONAL_TARGET_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'optional-target',
  name: 'Optional Target',
  description: 'Service used to verify optional dependency startup behavior.',
  startPolicy: {
    defaultMode: 'related',
    requiredDependencies: [],
    optionalDependencies: [SLOW_OPTIONAL_DEPENDENCY.id],
  },
}

test('managed spawn filters parent values and resolves authoritative local environment last', async (t) => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'groupher-managed-env-'))
  const parentKey = 'GROUPHER_TEST_PARENT_WINS'
  const previousParentValue = process.env[parentKey]
  const previousLoginValue = process.env.AUTH_LOCAL_LOGIN_ENABLED
  const previousSecretValue = process.env.SERVICE_AUTH_CLIENT_SECRET
  process.env[parentKey] = 'parent'
  process.env.AUTH_LOCAL_LOGIN_ENABLED = 'false'
  process.env.SERVICE_AUTH_CLIENT_SECRET = 'parent-secret'

  const definition: TServiceDefinition = {
    ...FIXTURE_SERVICE,
    id: 'managed-env-fixture',
    args: [
      '-e',
      'console.log(JSON.stringify({ parent: process.env.GROUPHER_TEST_PARENT_WINS, orchestrator: process.env.GROUPHER_TEST_ORCHESTRATOR_WINS, login: process.env.AUTH_LOCAL_LOGIN_ENABLED, clientSecret: process.env.SERVICE_AUTH_CLIENT_SECRET ?? null }))',
    ],
    env: {
      GROUPHER_TEST_ORCHESTRATOR_WINS: 'orchestrator',
    },
    localEnvironment: {
      env: { AUTH_LOCAL_LOGIN_ENABLED: 'true' },
    },
  }
  const manager = new ServiceManager(
    [definition],
    null,
    undefined,
    undefined,
    undefined,
    async () => ({ formatVersion: 1, repoRoot: fixtureRoot, secrets: {}, serviceCredentials: {} }),
  )

  t.after(async () => {
    await manager.shutdown()
    await rm(fixtureRoot, { force: true, recursive: true })
    if (previousParentValue === undefined) delete process.env[parentKey]
    else process.env[parentKey] = previousParentValue
    if (previousLoginValue === undefined) delete process.env.AUTH_LOCAL_LOGIN_ENABLED
    else process.env.AUTH_LOCAL_LOGIN_ENABLED = previousLoginValue
    if (previousSecretValue === undefined) delete process.env.SERVICE_AUTH_CLIENT_SECRET
    else process.env.SERVICE_AUTH_CLIENT_SECRET = previousSecretValue
  })

  await manager.start(definition.id)
  await waitForLog(manager, definition.id, '"login":"true"')

  const output = manager
    .getLogs(definition.id)
    .filter((log) => log.stream === 'stdout')
    .map((log) => log.chunk)
    .join('')
  assert.match(
    output,
    /"parent":"parent","orchestrator":"orchestrator","login":"true","clientSecret":null/,
  )
})

test('saved local configuration reaches the next real managed process and Worker projection', async (t) => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'groupher-saved-env-'))
  const definition: TServiceDefinition = {
    ...FIXTURE_SERVICE,
    id: 'saved-env-fixture',
    workerEnvFile: true,
    localEnvironment: { env: { DB_NAME: 'default_db' }, editableEnvKeys: ['DB_NAME'] },
    args: ['-e', 'console.log(process.env.DB_NAME); setInterval(() => {}, 1000)'],
  }
  const store = new ServiceEnvironmentStore([definition], fixtureRoot)
  const manager = new ServiceManager(
    [definition],
    null,
    undefined,
    undefined,
    undefined,
    async () => ({ formatVersion: 1, repoRoot: fixtureRoot, secrets: {}, serviceCredentials: {} }),
  )
  t.after(async () => {
    await manager.shutdown()
    await rm(fixtureRoot, { force: true, recursive: true })
  })
  await store.update(definition.id, { DB_NAME: 'saved_before_start' })
  const started = await manager.start(definition.id)
  await waitForLog(manager, definition.id, 'saved_before_start')
  await store.update(definition.id, { DB_NAME: 'saved_for_next_start' })
  assert.equal(
    manager.listServices().find((service) => service.id === definition.id)?.pid,
    started.pid,
  )
  await manager.stop(definition.id)
  await manager.start(definition.id)
  await waitForLog(manager, definition.id, 'saved_for_next_start')
  const { readFile } = await import('node:fs/promises')
  const { parseEnv } = await import('node:util')
  const projection = await readFile(
    localWorkerEnvironmentPaths(definition.id, fixtureRoot).envFile,
    'utf8',
  )
  assert.equal(parseEnv(projection).DB_NAME, 'saved_for_next_start')
})

test('managed Worker receives its private persistent state directory', async (t) => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'groupher-worker-state-'))
  const definition: TServiceDefinition = {
    ...FIXTURE_SERVICE,
    id: 'worker-state-fixture',
    args: ['-e', 'console.log(process.env.DEV_HUB_WORKER_STATE_DIR)'],
    workerStateDir: true,
  }
  const manager = new ServiceManager(
    [definition],
    null,
    undefined,
    undefined,
    undefined,
    async () => ({ formatVersion: 1, repoRoot: fixtureRoot, secrets: {}, serviceCredentials: {} }),
  )

  t.after(async () => {
    await manager.shutdown()
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  await manager.start(definition.id)
  await waitForLog(manager, definition.id, 'worker-state-fixture')

  const output = manager
    .getLogs(definition.id)
    .filter((log) => log.stream === 'stdout')
    .map((log) => log.chunk)
    .join('')
  assert.equal(output.trim(), localWorkerEnvironmentPaths(definition.id, fixtureRoot).directory)
})

test(
  'stop gives a managed process a grace period before it exits',
  { timeout: 2_000 },
  async (t) => {
    const manager = new ServiceManager([FIXTURE_SERVICE])
    t.after(async () => manager.shutdown())

    const started = await manager.start(FIXTURE_SERVICE.id)
    assert.equal(started.status, 'running')
    await waitForLog(manager, FIXTURE_SERVICE.id, 'READY')

    const stoppedEvent = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Managed process did not stop within one second.')),
        1_000,
      )
      const unsubscribe = manager.subscribe((event) => {
        if (
          event.type !== 'status' ||
          event.service.id !== FIXTURE_SERVICE.id ||
          event.service.status !== 'stopped'
        ) {
          return
        }

        clearTimeout(timeout)
        unsubscribe()
        assert.equal(event.service.pid, null)
        resolve()
      })
    })

    const stopped = await manager.stop(FIXTURE_SERVICE.id)
    assert.equal(stopped.status, 'stopped')
    assert.equal(stopped.pid, null)
    await stoppedEvent
    assert.match(
      manager
        .getLogs(FIXTURE_SERVICE.id)
        .map((log) => log.chunk)
        .join(''),
      /SIGTERM received/,
    )
  },
)

test(
  'stop force-kills a managed process after the grace period expires',
  { timeout: 2_500 },
  async (t) => {
    const manager = new ServiceManager([STUBBORN_FIXTURE_SERVICE])
    t.after(async () => manager.shutdown())

    await manager.start(STUBBORN_FIXTURE_SERVICE.id)
    await waitForLog(manager, STUBBORN_FIXTURE_SERVICE.id, 'READY')
    const stopped = await manager.stop(STUBBORN_FIXTURE_SERVICE.id)

    assert.equal(stopped.status, 'stopped')
    assert.equal(stopped.pid, null)
  },
)

async function waitForLog(manager: ServiceManager, serviceId: string, text: string): Promise<void> {
  const deadline = Date.now() + 1_000
  while (Date.now() < deadline) {
    if (
      manager.getLogs(serviceId).some((log) => log.stream === 'stdout' && log.chunk.includes(text))
    ) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for ${serviceId} to log ${text}.`)
}

test('restart waits for the managed process to stop before starting a replacement', async (t) => {
  const manager = new ServiceManager([FIXTURE_SERVICE])
  t.after(async () => manager.shutdown())

  const started = await manager.start(FIXTURE_SERVICE.id)
  const statuses: string[] = []
  manager.subscribe((event) => {
    if (event.type === 'status' && event.service.id === FIXTURE_SERVICE.id) {
      statuses.push(event.service.status)
    }
  })

  const restarted = await manager.restart(FIXTURE_SERVICE.id)

  assert.equal(restarted.status, 'running')
  assert.notEqual(restarted.pid, started.pid)
  assert.deepEqual(statuses, ['stopping', 'stopped', 'running'])
  assert.match(
    manager
      .getLogs(FIXTURE_SERVICE.id)
      .map((log) => log.chunk)
      .join(''),
    /Restarting service with a fresh process/,
  )
})

test('restart reruns configured startup contracts before replacing the target', async (t) => {
  const checks: string[] = []
  const manager = new ServiceManager(
    [CONTRACT_TARGET_SERVICE],
    null,
    async () => false,
    {
      findProcessGroups: async () => [],
      terminateProcessGroup: async () => undefined,
    },
    async (check) => {
      checks.push(check.id)
    },
  )
  t.after(async () => manager.shutdown())

  await manager.start(CONTRACT_TARGET_SERVICE.id)
  await manager.restart(CONTRACT_TARGET_SERVICE.id)

  assert.deepEqual(checks, ['service-auth-contract'])
})

test('restart waits for the managed port to be released before starting a replacement', async (t) => {
  let portChecks = 0
  const portProbe = async () => {
    portChecks += 1
    return portChecks === 2 || portChecks === 3
  }
  const manager = new ServiceManager([PORT_FIXTURE_SERVICE], null, portProbe)
  t.after(async () => manager.shutdown())

  const started = await manager.start(PORT_FIXTURE_SERVICE.id)
  const restarted = await manager.restart(PORT_FIXTURE_SERVICE.id)

  assert.equal(restarted.status, 'starting')
  assert.notEqual(restarted.pid, started.pid)
  assert.equal(portChecks, 5)
})

test('restart safely takes over a matching external process group', async (t) => {
  let listening = true
  const terminatedGroups: number[] = []
  const manager = new ServiceManager([EXTERNAL_FIXTURE_SERVICE], null, async () => listening, {
    findProcessGroups: async () => [65_432],
    terminateProcessGroup: async (pgid) => {
      terminatedGroups.push(pgid)
      listening = false
    },
  })
  t.after(async () => manager.shutdown())

  await manager.initialize()
  assert.equal(manager.listServices()[0]?.status, 'starting')
  assert.notEqual(manager.listServices()[0]?.pid, null)

  const restarted = await manager.restart(EXTERNAL_FIXTURE_SERVICE.id)

  assert.equal(restarted.status, 'starting')
  assert.deepEqual(terminatedGroups, [65_432])
})

test('restart refuses to kill an unverified external process', async (t) => {
  let terminateCalls = 0
  const manager = new ServiceManager([EXTERNAL_FIXTURE_SERVICE], null, async () => true, {
    findProcessGroups: async () => [],
    terminateProcessGroup: async () => {
      terminateCalls += 1
    },
  })
  t.after(async () => manager.shutdown())

  await manager.initialize()

  await assert.rejects(
    manager.restart(EXTERNAL_FIXTURE_SERVICE.id),
    (error: unknown) =>
      error instanceof ServiceManagerError &&
      error.statusCode === 409 &&
      error.message.includes('could not safely identify'),
  )
  assert.equal(terminateCalls, 0)
})

test('initialize starts required dependencies for an adopted service', async (t) => {
  let listening = true
  const terminatedGroups: number[] = []
  const manager = new ServiceManager(
    [CHAIN_DEPENDENCY_SERVICE, ADOPTED_TARGET_SERVICE],
    null,
    async () => listening,
    {
      findProcessGroups: async (definition) =>
        definition.id === ADOPTED_TARGET_SERVICE.id ? [65_432] : [],
      terminateProcessGroup: async (pgid) => {
        terminatedGroups.push(pgid)
        listening = false
      },
    },
  )
  t.after(async () => manager.shutdown())

  await manager.initialize()

  assert.deepEqual(
    manager.listServices().map((service) => [service.id, service.status]),
    [
      [CHAIN_DEPENDENCY_SERVICE.id, 'running'],
      [ADOPTED_TARGET_SERVICE.id, 'starting'],
    ],
  )
  assert.deepEqual(terminatedGroups, [65_432])
})

test('default start mode starts required dependencies before the target service', async (t) => {
  const manager = new ServiceManager([
    CHAIN_DEPENDENCY_SERVICE,
    OPTIONAL_DEPENDENCY_SERVICE,
    CHAIN_TARGET_SERVICE,
  ])
  t.after(async () => manager.shutdown())

  const statuses: string[] = []
  manager.subscribe((event) => {
    if (event.type === 'status') statuses.push(`${event.service.id}:${event.service.status}`)
  })

  const services = await manager.startWithMode(CHAIN_TARGET_SERVICE.id)

  assert.deepEqual(
    services.map((service) => service.id),
    [CHAIN_DEPENDENCY_SERVICE.id, CHAIN_TARGET_SERVICE.id],
  )
  assert.deepEqual(statuses, [
    `${CHAIN_DEPENDENCY_SERVICE.id}:running`,
    `${CHAIN_TARGET_SERVICE.id}:running`,
  ])
})

test('chain startup runs contract checks after required dependencies are ready', async (t) => {
  const checks: string[] = []
  let manager: ServiceManager
  manager = new ServiceManager(
    [CHAIN_DEPENDENCY_SERVICE, CONTRACT_TARGET_SERVICE],
    null,
    async () => false,
    {
      findProcessGroups: async () => [],
      terminateProcessGroup: async () => undefined,
    },
    async (check) => {
      checks.push(check.id)
      assert.equal(
        manager.listServices().find((service) => service.id === CHAIN_DEPENDENCY_SERVICE.id)
          ?.status,
        'running',
      )
      assert.equal(
        manager.listServices().find((service) => service.id === CONTRACT_TARGET_SERVICE.id)?.status,
        'stopped',
      )
    },
  )
  t.after(async () => manager.shutdown())

  await manager.startWithMode(CONTRACT_TARGET_SERVICE.id)

  assert.deepEqual(checks, ['service-auth-contract'])
  assert.equal(
    manager.listServices().find((service) => service.id === CONTRACT_TARGET_SERVICE.id)?.status,
    'running',
  )
})

test('a failed startup contract blocks the target and preserves the reason', async (t) => {
  const manager = new ServiceManager(
    [CHAIN_DEPENDENCY_SERVICE, CONTRACT_TARGET_SERVICE],
    null,
    async () => false,
    {
      findProcessGroups: async () => [],
      terminateProcessGroup: async () => undefined,
    },
    async () => {
      throw new Error('SERVICE_TOKEN_INVALID')
    },
  )
  t.after(async () => manager.shutdown())

  await assert.rejects(
    manager.startWithMode(CONTRACT_TARGET_SERVICE.id),
    /Auth to Phoenix Service Identity contract failed: SERVICE_TOKEN_INVALID/,
  )
  assert.equal(
    manager.listServices().find((service) => service.id === CONTRACT_TARGET_SERVICE.id)?.status,
    'stopped',
  )
  assert.match(
    manager
      .getLogs(CONTRACT_TARGET_SERVICE.id)
      .map((log) => log.chunk)
      .join(''),
    /SERVICE_TOKEN_INVALID/,
  )
})

test('required dependencies in the same layer start in parallel', async (t) => {
  const readyPorts = new Set<number>()
  const portProbe = async (port: number) => readyPorts.has(port)
  const manager = new ServiceManager(
    [PARALLEL_DEPENDENCY_A, PARALLEL_DEPENDENCY_B, PARALLEL_TARGET_SERVICE],
    null,
    portProbe,
  )
  t.after(async () => manager.shutdown())

  const statuses: string[] = []
  manager.subscribe((event) => {
    if (event.type === 'status') statuses.push(`${event.service.id}:${event.service.status}`)
  })

  const started = manager.startWithMode(PARALLEL_TARGET_SERVICE.id)
  await waitForStatuses(statuses, [
    `${PARALLEL_DEPENDENCY_A.id}:starting`,
    `${PARALLEL_DEPENDENCY_B.id}:starting`,
  ])

  assert.equal(statuses.includes(`${PARALLEL_TARGET_SERVICE.id}:running`), false)

  readyPorts.add(PARALLEL_DEPENDENCY_A.port || 0)
  readyPorts.add(PARALLEL_DEPENDENCY_B.port || 0)

  const services = await started
  assert.deepEqual(
    services.map((service) => service.id),
    [PARALLEL_DEPENDENCY_A.id, PARALLEL_DEPENDENCY_B.id, PARALLEL_TARGET_SERVICE.id],
  )
})

test('self start mode skips configured dependencies', async (t) => {
  const manager = new ServiceManager([CHAIN_DEPENDENCY_SERVICE, CHAIN_TARGET_SERVICE])
  t.after(async () => manager.shutdown())

  const services = await manager.startWithMode(CHAIN_TARGET_SERVICE.id, 'self')

  assert.deepEqual(
    services.map((service) => service.id),
    [CHAIN_TARGET_SERVICE.id],
  )
})

test('related start mode includes optional dependencies', async (t) => {
  const manager = new ServiceManager([
    CHAIN_DEPENDENCY_SERVICE,
    OPTIONAL_DEPENDENCY_SERVICE,
    CHAIN_TARGET_SERVICE,
  ])
  t.after(async () => manager.shutdown())

  const services = await manager.startWithMode(CHAIN_TARGET_SERVICE.id, 'related')

  assert.deepEqual(
    services.map((service) => service.id),
    [CHAIN_DEPENDENCY_SERVICE.id, OPTIONAL_DEPENDENCY_SERVICE.id, CHAIN_TARGET_SERVICE.id],
  )
})

test('related start mode does not wait for optional dependencies to become ready', async (t) => {
  const manager = new ServiceManager(
    [SLOW_OPTIONAL_DEPENDENCY, OPTIONAL_TARGET_SERVICE],
    null,
    async () => false,
  )
  t.after(async () => manager.shutdown())

  const services = await manager.startWithMode(OPTIONAL_TARGET_SERVICE.id, 'related')

  assert.deepEqual(
    services.map((service) => [service.id, service.status]),
    [
      [SLOW_OPTIONAL_DEPENDENCY.id, 'starting'],
      [OPTIONAL_TARGET_SERVICE.id, 'running'],
    ],
  )
})

async function waitForStatuses(statuses: string[], expected: string[]): Promise<void> {
  const deadline = Date.now() + 1_000
  while (Date.now() < deadline) {
    if (expected.every((status) => statuses.includes(status))) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for statuses: ${expected.join(', ')}.`)
}
