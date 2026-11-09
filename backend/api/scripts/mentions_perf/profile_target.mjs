import { spawnSync } from 'node:child_process'
/** Aggregate-only target probe: existing Fly release RPC -> READ ONLY SQL -> public counters. */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = process.argv[2]
if (!output) throw new Error('Usage: node scripts/mentions_perf/profile_target.mjs <output.json>')
const source = readFileSync(fileURLToPath(new URL('./profile.exs', import.meta.url)), 'utf8')
const census = process.argv.includes('--body-census') ? 'mentions_perf_body_census = true\n' : ''
const code = `Code.eval_string(Base.decode64!("${Buffer.from(census + source).toString('base64')}"))`
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`
const result = spawnSync(
  'fly',
  [
    'ssh',
    'console',
    '--app',
    'groupher-api',
    '--command',
    `/app/bin/groupher_server rpc ${quote(code)}`,
  ],
  { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 },
)
if (result.error || result.status !== 0) {
  throw new Error(
    `Read-only profile failed: ${result.error?.message || result.stderr || result.stdout}`,
  )
}
const line = result.stdout.split('\n').find((line) => line.startsWith('MENTIONS_PERF_PROFILE='))
if (!line) throw new Error('Target did not return a profile; no result was accepted')
const profile = JSON.parse(line.slice('MENTIONS_PERF_PROFILE='.length))
writeFileSync(output, JSON.stringify(profile, null, 2) + '\n', { mode: 0o600 })
console.log(
  JSON.stringify({
    output,
    newGraphAvailable: profile.new_graph_data_available,
    tables: profile.tables,
  }),
)
