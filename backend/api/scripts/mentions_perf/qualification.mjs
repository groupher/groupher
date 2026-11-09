import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
export const requiredCases = [
  'http_graph_first',
  'http_graph_cursor',
  'graph_hub_first',
  'graph_hub_cursor',
  'outgoing_cursor',
  'outgoing_cursor_second',
  'incoming_cursor',
  'outgoing_offset_count',
  'outgoing_deep_offset_count',
  'comment_outgoing',
  'doc_comment_seeds',
  'revision',
]

/** Summarizes independent controlled-fixture runs without promoting them to B2 acceptance. */
export function summarizeQualification(runs) {
  const sampleCounts = runs.flatMap((run) =>
    requiredCases.map((name) => run.summary.reads?.[name]?.requests || 0),
  )
  const minimumSamplesPerCase = Math.min(Infinity, ...sampleCounts)
  const firstAttemptRatios = runs.map((run) => {
    const readers = run.summary.load?.revision_writers_paced?.readers
    return readers ? (readers.outcomes.ok || 0) / readers.requests : null
  })

  return {
    status: 'PARTIAL',
    accepted: false,
    dataset_kind: 'controlled canonical fixture with offline occurrence construction',
    independent_runs: runs.length,
    minimum_samples_per_case: Number.isFinite(minimumSamplesPerCase)
      ? minimumSamplesPerCase
      : null,
    first_attempt_success_ratios: firstAttemptRatios,
    blockers: [
      ...(runs.length === 3 ? [] : ['three_independent_runs_incomplete']),
      ...(minimumSamplesPerCase >= 1000 ? [] : ['qualification_sample_count']),
      'target_body_graph_or_approved_capacity_envelope_provenance_missing',
      'target_database_capacity_and_design_load_not_verified',
    ],
    runs: runs.map(({ directory, process_status, review }) => ({
      directory,
      process_status,
      pilot_read_limits_passed: review.pilot_read_limits_passed,
      lock_probe_passed: review.lock_probe_passed,
      candidate_paced_first_attempt_success_ratio:
        review.candidate_paced_first_attempt_success_ratio,
      candidate_paced_availability_passed: review.candidate_paced_availability_passed,
      summary_sha256: review.summary_sha256,
    })),
  }
}

const run = (command, args, options) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  return result.status
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDir = resolve(process.argv[2] || '')
  const targetProfile = process.argv[3] ? resolve(process.argv[3]) : null
  if (!process.argv[2]) {
    throw new Error('Usage: node scripts/mentions_perf/qualification.mjs <output-dir> [target-profile.json]')
  }
  if (targetProfile && !existsSync(targetProfile)) throw new Error('Target profile does not exist')

  mkdirSync(outputDir, { recursive: true })
  const runs = []
  for (let index = 1; index <= 3; index += 1) {
    const directory = resolve(outputDir, `run-${index}`)
    const runStatus = run(
      process.execPath,
      [resolve(scriptDir, 'run.mjs'), 'standard', directory],
      { env: { ...process.env, CMS_MENTIONS_PERF_SAMPLES: '1000' } },
    )
    if (![0, 2].includes(runStatus) || !existsSync(resolve(directory, 'summary.json'))) {
      throw new Error(`Qualification run ${index} failed before writing its summary`)
    }

    const reviewArgs = [resolve(scriptDir, 'review.mjs'), directory]
    if (targetProfile) reviewArgs.push(targetProfile)
    const reviewStatus = run(process.execPath, reviewArgs, { env: process.env })
    if (![0, 2].includes(reviewStatus) || !existsSync(resolve(directory, 'review.json'))) {
      throw new Error(`Independent review ${index} failed`)
    }

    runs.push({
      directory,
      process_status: runStatus,
      summary: JSON.parse(readFileSync(resolve(directory, 'summary.json'), 'utf8')),
      review: JSON.parse(readFileSync(resolve(directory, 'review.json'), 'utf8')),
    })
  }

  const report = summarizeQualification(runs)
  writeFileSync(resolve(outputDir, 'qualification.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ status: report.status, blockers: report.blockers }))
}
