import { spawnSync } from 'node:child_process'
import { mkdirSync, openSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve(process.argv[2] || `/tmp/mentions-writer-load-${Date.now()}`)
mkdirSync(output, { recursive: true })
const env = {
  ...process.env,
  MIX_ENV: 'test',
  TEST_DB_NAME: `groupher_mentions_perf_writer_${Date.now()}_${process.pid}`,
}

for (const [label, args] of [
  ['create', ['ecto.create']],
  ['migrate', ['ecto.migrate']],
  ['load', ['run', '--no-start', 'scripts/mentions_perf/writer_load.exs']],
]) {
  const fd = openSync(`${output}/${label}.log`, 'w', 0o600)
  const result = spawnSync('mix', args, { env, stdio: ['ignore', fd, fd] })
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed; inspect ${output}/${label}.log`)
  }
}

console.log(`Completed local writer load; see ${output}/load.log. Database retained.`)
