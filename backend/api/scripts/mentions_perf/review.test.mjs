import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { review } from './review.mjs'

const spec = JSON.parse(readFileSync(new URL('./acceptance.json', import.meta.url)))
const fixture = () => ({
  reads: Object.fromEntries(
    spec.pilot.required_cases.map((name) => [
      name,
      {
        requests: 100,
        outcomes: { ok: 100 },
        max_sql_count: 13,
        latency_ms: { p95: 100, max: 200 },
        passed: true,
      },
    ]),
  ),
  controlled_lock: { blocking_observed: true, reader_while_locked: { outcome: 'ok' } },
  load: {
    revision_writers_paced: {
      readers: { requests: 80, outcomes: { ok: 72, mentions_graph_invalid_request: 8 } },
    },
  },
  environment: { postgres: 'PostgreSQL 14.23' },
  dataset: { body_capture_representative: false },
  target_profile: { settings: [['server_version', '17.11']], degree_distribution: null },
})
const plans = Object.fromEntries(
  spec.pilot.required_cases.map((name) => [
    name,
    [
      {
        metrics: {
          scans: name === 'revision' ? [] : [{ relation: 'mention_current_edges', work: 21 }],
        },
      },
    ],
  ]),
)

test('successful latency and a true legacy flag cannot hide fence rejection or incomplete target evidence', () => {
  const result = review(fixture(), plans, spec)
  assert.equal(result.pilot_read_limits_passed, true)
  assert.equal(result.candidate_paced_first_attempt_success_ratio, 0.9)
  assert.equal(result.pilot_verdict, 'PARTIAL')
  assert.equal(result.b2_performance_accepted, false)
  assert.ok(result.blockers.includes('postgres_major_version_mismatch'))
  assert.ok(
    result.blockers.includes('authoritative_graph_or_qualified_envelope_distribution_missing'),
  )
})

test('observes SQL count and enforces the edge scan limit even when the raw passed flag is true', () => {
  const summary = fixture()
  summary.reads.graph_hub_first.max_sql_count = 33
  const result = review(
    summary,
    {
      graph_hub_first: [
        { metrics: { scans: [{ relation: 'mention_current_edges', work: 5000 }] } },
      ],
    },
    spec,
  )
  const graph = result.reads.find((row) => row.name === 'graph_hub_first')
  assert.equal(graph.max_sql_count, 33)
  assert.deepEqual(graph.failures, ['edge_scan_work'])
})

test('a local pilot with all limits met still cannot certify target B2', () => {
  const summary = fixture()
  summary.load.revision_writers_paced.readers.outcomes = { ok: 80 }
  const result = review(summary, plans, spec)
  assert.equal(result.pilot_verdict, 'PASS')
  assert.equal(result.b2_performance_accepted, false)
  assert.ok(result.blockers.includes('qualification_sample_count'))
})

test('omitting a required workload cannot turn a partial pilot into a pass', () => {
  const summary = fixture()
  summary.load.revision_writers_paced.readers.outcomes = { ok: 80 }
  delete summary.reads.http_graph_cursor
  const result = review(summary, plans, spec)
  assert.equal(result.pilot_read_limits_passed, false)
  assert.deepEqual(result.missing_cases, ['http_graph_cursor'])
})

test('reports bounded HTTP recovery separately from first-request success', () => {
  const summary = fixture()
  summary.load.http_paced_single = {
    readers: { requests: 100, outcomes: { ok: 88, mentions_graph_invalid_request: 12 } },
  }
  summary.load.http_paced_restart_once = {
    readers: {
      requests: 100,
      outcomes: { ok: 99, mentions_graph_invalid_request: 1 },
      restarted_interactions: 12,
      max_server_request_sql_count: 13,
      max_server_request_elapsed_ms: 300,
    },
  }
  const result = review(summary, plans, spec)
  assert.equal(result.candidate_paced_first_attempt_success_ratio, 0.9)
  assert.equal(result.candidate_http_single_request_success_ratio, 0.88)
  assert.equal(result.candidate_http_recovered_interaction_success_ratio, 0.99)
  assert.equal(result.candidate_http_recovery_second_requests, 12)
  assert.equal(result.candidate_http_recovery_max_server_request_sql_count, 13)
  assert.equal(result.pilot_verdict, 'PARTIAL')
  assert.equal(result.b2_performance_accepted, false)
})

test('matching target PostgreSQL major removes only the version blocker', () => {
  const summary = fixture()
  summary.environment.postgres = 'PostgreSQL 17.11 (Homebrew)'
  const result = review(summary, plans, spec)
  assert.equal(result.blockers.includes('postgres_major_version_mismatch'), false)
  assert.equal(result.b2_performance_accepted, false)
  assert.ok(result.blockers.includes('controlled_fixture_not_target_body_graph'))
})
