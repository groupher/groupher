import assert from 'node:assert/strict'
import test from 'node:test'

import { aggregateProcessGroup, parseProcessTable } from './process-metrics-monitor.ts'

test('parses and aggregates every process in a managed process group', () => {
  const rows = parseProcessTable(`
    101  101  12.5  2048
    102  101   7.5  1024
    201  201  40.0  8192
  `)

  assert.deepEqual(
    aggregateProcessGroup(rows, {
      serviceId: 'main',
      pid: 101,
      runId: 'main-run',
    }),
    {
      cpuPercent: 20,
      rssBytes: 3 * 1024 * 1024,
      processCount: 2,
    },
  )
})
