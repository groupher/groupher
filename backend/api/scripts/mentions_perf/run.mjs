import { spawnSync } from 'node:child_process'
/** Fresh local DB -> migrations -> guarded capacity runner; never drops data or contacts a target. */
import { mkdirSync, openSync } from 'node:fs'
import { resolve } from 'node:path'

const scale = process.argv[2] || 'smoke'
const sizes = { smoke: [4, 5], catalog: [4, 100], standard: [24, 100], large: [96, 100] }
if (!sizes[scale]) throw new Error('Scale must be smoke, catalog, standard or large')
const output = resolve(process.argv[3] || `/tmp/mentions-perf-${Date.now()}`)
mkdirSync(output, { recursive: true })
const [perType, samples] = sizes[scale]
const env = {
  ...process.env,
  MIX_ENV: 'test',
  TEST_DB_NAME: `groupher_mentions_perf_${Date.now()}_${process.pid}`,
  CMS_MENTIONS_PERF_PER_TYPE: String(perType),
  CMS_MENTIONS_PERF_SAMPLES: process.env.CMS_MENTIONS_PERF_SAMPLES || String(samples),
  CMS_MENTIONS_PERF_OUTPUT: output,
}
if (
  !Number.isInteger(Number(env.CMS_MENTIONS_PERF_SAMPLES)) ||
  Number(env.CMS_MENTIONS_PERF_SAMPLES) < 3 ||
  Number(env.CMS_MENTIONS_PERF_SAMPLES) > 1000
)
  throw new Error('Samples must be an integer from 3 to 1000')
env.CMS_MENTIONS_PERF_CATALOG = scale === 'catalog' ? '1' : '0'
env.CMS_MENTIONS_PERF_HIDDEN_STRESS = scale === 'large' ? '1' : '0'
delete env.CMS_MENTIONS_PERF_REUSE
delete env.CMS_MENTIONS_PERF_LOAD_ONLY
if (scale === 'catalog') {
  if (!env.CMS_MENTIONS_PERF_PROFILE) throw new Error('Catalog requires CMS_MENTIONS_PERF_PROFILE')
  env.CMS_MENTIONS_PERF_CATALOG = '1'
}
for (const [label, args] of [
  ['create', ['ecto.create']],
  ['migrate', ['ecto.migrate']],
  ['measure', ['run', '--no-start', 'scripts/mentions_perf/run.exs']],
]) {
  console.log(`${label}: ${env.TEST_DB_NAME}; log ${output}/${label}.log`)
  const fd = openSync(`${output}/${label}.log`, 'w', 0o600)
  const result = spawnSync('mix', args, { env, stdio: ['ignore', fd, fd] })
  if (result.error || result.status !== 0) {
    console.error(
      `${label} failed (${result.error?.message || result.status}); inspect ${output}/${label}.log`,
    )
    process.exit(result.status || 1)
  }
}
console.log(`Completed ${scale}; see ${output}/summary.json. Database retained for inspection.`)
