import assert from 'node:assert/strict'
import test from 'node:test'

import { requiredCases, summarizeQualification } from './qualification.mjs'

test('three clean controlled runs still cannot claim target B2 acceptance', () => {
  const runs = Array.from({ length: 3 }, (_, index) => ({
    directory: `run-${index + 1}`,
    process_status: 0,
    summary: {
      reads: Object.fromEntries(requiredCases.map((name) => [name, { requests: 1000 }])),
      load: { revision_writers_paced: { readers: { requests: 1000, outcomes: { ok: 980 } } } },
    },
    review: {
      pilot_read_limits_passed: true,
      lock_probe_passed: true,
      candidate_paced_first_attempt_success_ratio: 0.98,
      candidate_paced_availability_passed: true,
      summary_sha256: `sha-${index + 1}`,
    },
  }))

  const result = summarizeQualification(runs)
  assert.equal(result.status, 'PARTIAL')
  assert.equal(result.accepted, false)
  assert.equal(result.independent_runs, 3)
  assert.equal(result.minimum_samples_per_case, 1000)
  assert.ok(result.blockers.includes('target_body_graph_or_approved_capacity_envelope_provenance_missing'))
  assert.ok(result.blockers.includes('target_database_capacity_and_design_load_not_verified'))
})

test('incomplete sample counts and missing runs stay visible as blockers', () => {
  const result = summarizeQualification([
    {
      directory: 'run-1',
      process_status: 2,
      summary: { reads: { graph: { requests: 100 } }, load: {} },
      review: {},
    },
  ])
  assert.ok(result.blockers.includes('three_independent_runs_incomplete'))
  assert.ok(result.blockers.includes('qualification_sample_count'))
})
