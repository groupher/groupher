import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { MetricsStore } from './metrics-store.ts'
import type { TServiceDefinition } from './services.ts'

const MB = 1024 * 1024
const definition: TServiceDefinition = {
  id: 'main',
  name: 'Main',
  description: 'Test service',
  group: 'frontend',
  monogram: 'MN',
  cwd: '/tmp',
  port: 3000,
  url: 'http://localhost:3000',
  metrics: {
    serverCpuPercent: 90,
    serverRssBytes: 1_024 * MB,
    browserBusyPercent: 50,
    browserHeapBytes: 512 * MB,
  },
}

test('keeps only the current local day and returns recorded history', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'dev-hub-metrics-'))
  const now = new Date(2026, 6, 23, 12, 0, 0).getTime()
  await mkdir(path.join(rootDir, '2026-07-22'), { recursive: true })
  const store = new MetricsStore(rootDir, [definition], { now: () => now })

  try {
    await store.initialize()
    await assert.rejects(access(path.join(rootDir, '2026-07-22')))

    await store.recordServer('main', 'main-run', {
      cpuPercent: 24.3,
      rssBytes: 320 * MB,
      processCount: 3,
    })
    await store.recordBrowser({
      serviceId: 'main',
      pageId: 'page-1',
      url: 'http://localhost:3000/home',
      visibility: 'visible',
      heapBytes: 128 * MB,
      busyPercent: 4.2,
      sampleWindowMs: 2_000,
    })

    const history = await store.getHistory('main', '1h')
    assert.equal(history.samples.length, 2)
    assert.deepEqual(
      new Set(history.samples.map((sample) => sample.source)),
      new Set(['server', 'browser']),
    )
    assert.equal(store.getNotices().length, 0)
  } finally {
    await store.close()
    await rm(rootDir, { force: true, recursive: true })
  }
})

test('pauses persistence and raises a notice at the per-service size limit', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'dev-hub-metrics-cap-'))
  const now = new Date(2026, 6, 23, 12, 0, 0).getTime()
  const maxFileBytes = 560
  const store = new MetricsStore(rootDir, [definition], {
    maxFileBytes,
    now: () => now,
  })

  try {
    await store.initialize()
    for (let index = 0; index < 12; index += 1) {
      await store.recordServer('main', 'main-run', {
        cpuPercent: index,
        rssBytes: (300 + index) * MB,
        processCount: 2,
      })
    }
    await store.flush()

    const notices = store.getNotices()
    assert.equal(notices.length, 1)
    assert.equal(notices[0]?.serviceId, 'main')
    assert.equal(notices[0]?.recordingPaused, true)

    const file = path.join(rootDir, '2026-07-23', 'main.jsonl')
    assert.ok((await stat(file)).size <= maxFileBytes)
    assert.equal(store.getSnapshots().main?.server?.cpuPercent, 11)
  } finally {
    await store.close()
    await rm(rootDir, { force: true, recursive: true })
  }
})

test('selects the newest visible browser page without sorting all pages', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'dev-hub-metrics-pages-'))
  let now = new Date(2026, 6, 23, 12, 0, 0).getTime()
  const store = new MetricsStore(rootDir, [definition], { now: () => now })

  try {
    await store.initialize()
    await store.recordBrowser({
      serviceId: 'main',
      pageId: 'visible-old',
      url: 'http://localhost:3000/visible-old',
      visibility: 'visible',
      heapBytes: 10,
      busyPercent: 1,
      sampleWindowMs: 2_000,
    })
    now += 1
    await store.recordBrowser({
      serviceId: 'main',
      pageId: 'hidden-new',
      url: 'http://localhost:3000/hidden-new',
      visibility: 'hidden',
      heapBytes: 20,
      busyPercent: 2,
      sampleWindowMs: 2_000,
    })

    assert.equal(store.getSnapshots().main?.browser?.pageId, 'visible-old')

    now += 1
    await store.recordBrowser({
      serviceId: 'main',
      pageId: 'visible-new',
      url: 'http://localhost:3000/visible-new',
      visibility: 'visible',
      heapBytes: 30,
      busyPercent: 3,
      sampleWindowMs: 2_000,
    })

    assert.equal(store.getSnapshots().main?.browser?.pageId, 'visible-new')
    assert.equal(store.getSnapshots().main?.browserPageCount, 3)
  } finally {
    await store.close()
    await rm(rootDir, { force: true, recursive: true })
  }
})
