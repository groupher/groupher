import assert from 'node:assert/strict'
import test from 'node:test'

import { ServiceManager } from './process-manager.ts'
import type { TServiceDefinition } from './services.ts'

const FIXTURE_SERVICE: TServiceDefinition = {
  id: 'stop-fixture',
  name: 'Stop Fixture',
  description: 'Long-running process used to verify immediate stops.',
  group: 'backend',
  monogram: 'SF',
  cwd: process.cwd(),
  command: process.execPath,
  args: ['-e', 'setInterval(() => {}, 1_000)'],
  metrics: {
    serverCpuPercent: 100,
    serverRssBytes: 1024 ** 3,
    browserBusyPercent: 50,
    browserHeapBytes: 512 * 1024 ** 2,
  },
}

const PORT_FIXTURE_SERVICE: TServiceDefinition = {
  ...FIXTURE_SERVICE,
  id: 'restart-port-fixture',
  name: 'Restart Port Fixture',
  description: 'Managed process used to verify restart port-release polling.',
  port: 65_534,
}

test(
  'stop terminates a managed process without a grace-period delay',
  { timeout: 2_000 },
  async (t) => {
    const manager = new ServiceManager([FIXTURE_SERVICE])
    t.after(async () => manager.shutdown())

    const started = await manager.start(FIXTURE_SERVICE.id)
    assert.equal(started.status, 'running')

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
  },
)

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
