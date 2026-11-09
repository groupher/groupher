/** Immutable measurements -> explicit pilot/qualification verdict; never treats fence failures as successes. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

/** Recomputes limits from raw samples/plans; incomplete provenance always blocks B2 qualification. */
export function review(summary, plans, spec) {
  const reads = Object.entries(summary.reads).map(([name, row]) => {
    const limit =
      name === 'revision'
        ? spec.proposed_p95_ms.revision
        : name.includes('seeds')
          ? spec.proposed_p95_ms.comment_seeds
          : name.includes('graph')
            ? spec.proposed_p95_ms.graph_first
            : spec.proposed_p95_ms.one_hop
    const statements = plans[name] || []
    const edgeWork = statements
      .flatMap((query) => query.metrics.scans)
      .filter((scan) => scan.relation === 'mention_current_edges')
      .map((scan) => scan.work)
    const maxEdgeScan = Math.max(0, ...edgeWork)
    const failures = []
    if (row.outcomes.ok !== row.requests) failures.push('read_errors')
    if (row.latency_ms.p95 > limit) failures.push('p95_latency')
    if (!statements.length) failures.push('missing_full_plan')
    if (
      !name.includes('offset') &&
      maxEdgeScan > spec.scan_review.bounded_window_max_edge_scan_work_per_node
    )
      failures.push('edge_scan_work')
    return {
      name,
      failures,
      max_edge_scan_work: maxEdgeScan,
      max_sql_count: row.max_sql_count,
      p95_ms: row.latency_ms.p95,
      p95_limit_ms: limit,
    }
  })
  const paced = summary.load.revision_writers_paced?.readers
  const successRatio = paced ? (paced.outcomes.ok || 0) / paced.requests : null
  const httpSingle = summary.load.http_paced_single?.readers
  const httpRecovered = summary.load.http_paced_restart_once?.readers
  const httpSingleRatio = httpSingle ? (httpSingle.outcomes.ok || 0) / httpSingle.requests : null
  const httpRecoveredRatio = httpRecovered
    ? (httpRecovered.outcomes.ok || 0) / httpRecovered.requests
    : null
  const availabilityPass =
    successRatio !== null &&
    successRatio >= spec.qualification.proposed_read_success_ratio_at_design_load
  const missingCases = spec.pilot.required_cases.filter((name) => !summary.reads[name])
  const readPass = missingCases.length === 0 && reads.every((row) => row.failures.length === 0)
  const lockPass =
    summary.controlled_lock.blocking_observed &&
    summary.controlled_lock.reader_while_locked.outcome === 'ok'
  const targetVersion = summary.target_profile?.settings.find(
    ([name]) => name === 'server_version',
  )?.[1]
  const localMajor = /PostgreSQL (\d+)/.exec(summary.environment.postgres)?.[1]
  const targetMajor = /^(\d+)/.exec(targetVersion || '')?.[1]
  const blockers = [
    'target_capacity_and_arrival_rates_not_qualified',
    'three_independent_qualification_runs_missing',
  ]
  if (localMajor !== targetMajor) blockers.push('postgres_major_version_mismatch')
  if (!summary.dataset.body_capture_representative)
    blockers.push('controlled_fixture_not_target_body_graph')
  if (!summary.target_profile?.degree_distribution)
    blockers.push('authoritative_graph_or_qualified_envelope_distribution_missing')
  if (
    Object.values(summary.reads).some(
      (row) => row.requests < spec.qualification.samples_per_case_per_run,
    )
  )
    blockers.push('qualification_sample_count')
  if (!readPass) blockers.push('pilot_read_limits')
  if (!lockPass) blockers.push('lock_probe')
  if (!availabilityPass) blockers.push('candidate_paced_first_attempt_availability')
  return {
    pilot_read_limits_passed: readPass,
    lock_probe_passed: lockPass,
    candidate_paced_first_attempt_success_ratio: successRatio,
    candidate_paced_availability_passed: availabilityPass,
    candidate_http_single_request_success_ratio: httpSingleRatio,
    candidate_http_recovered_interaction_success_ratio: httpRecoveredRatio,
    candidate_http_recovered_interaction_requests: httpRecovered?.requests ?? null,
    candidate_http_recovery_second_requests: httpRecovered?.restarted_interactions ?? null,
    candidate_http_recovery_max_server_request_sql_count:
      httpRecovered?.max_server_request_sql_count ?? null,
    candidate_http_recovery_max_server_request_elapsed_ms:
      httpRecovered?.max_server_request_elapsed_ms ?? null,
    design_load_agreed: false,
    pilot_verdict: readPass && lockPass && availabilityPass ? 'PASS' : 'PARTIAL',
    missing_cases: missingCases,
    b2_performance_accepted: false,
    blockers,
    reads,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = resolve(process.argv[2])
  const summaryBytes = readFileSync(`${directory}/summary.json`)
  const specBytes = readFileSync(new URL('./acceptance.json', import.meta.url))
  const targetProfileBytes = process.argv[3] ? readFileSync(resolve(process.argv[3])) : null
  const summary = JSON.parse(summaryBytes)
  if (targetProfileBytes) summary.target_profile = JSON.parse(targetProfileBytes)
  const result = review(
    summary,
    JSON.parse(gunzipSync(readFileSync(`${directory}/full-plans.json.gz`))),
    JSON.parse(specBytes),
  )
  result.measurement_acceptance_sha256 = summary.acceptance_sha256 || null
  result.summary_sha256 = createHash('sha256').update(summaryBytes).digest('hex')
  result.acceptance_sha256 = createHash('sha256').update(specBytes).digest('hex')
  result.target_profile_sha256 = targetProfileBytes
    ? createHash('sha256').update(targetProfileBytes).digest('hex')
    : null
  writeFileSync(`${directory}/review.json`, JSON.stringify(result, null, 2) + '\n')
  console.log(
    JSON.stringify({
      pilot: result.pilot_verdict,
      availability: result.candidate_paced_first_attempt_success_ratio,
      blockers: result.blockers,
    }),
  )
  if (result.pilot_verdict !== 'PASS') process.exitCode = 2
}
