import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = process.argv[2]
if (!output || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/mentions_graph_target_report.mjs <output.json>')
}

const source = readFileSync(
  fileURLToPath(new URL('./mentions_graph_b0_report.exs', import.meta.url)),
  'utf8',
)
const code = `Code.eval_string(Base.decode64!("${Buffer.from(source).toString('base64')}"))`
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
  throw new Error(`Read-only Mentions report failed: ${result.error?.message || result.stderr || result.stdout}`)
}

const line = result.stdout.split('\n').find((item) => item.startsWith('MENTIONS_B0_REPORT='))
if (!line) throw new Error('Target did not return a Mentions report')

const report = JSON.parse(line.slice('MENTIONS_B0_REPORT='.length))
if (report.mode !== 'report-only' || typeof report.database !== 'string') {
  throw new Error('Target returned an invalid Mentions report')
}

writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ output, database: report.database, mode: report.mode }))
