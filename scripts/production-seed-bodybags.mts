/** Generates the trusted Node BodyBags consumed by the release-only acceptance seed. */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { publishContent } from '../packages/content-publisher/index'
import { seedCommandId } from './production-seed-identity.mts'
const [runId, output] = process.argv.slice(2)
if (!runId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(runId))
  throw new Error('A valid runId is required')
if (!output)
  throw new Error('Usage: pnpm exec tsx scripts/production-seed-bodybags.mts RUN_ID OUTPUT.json')
const bodyBag = await publishContent({
  format: 'markdown',
  markdown:
    'Production acceptance fixture. This fixed text exercises the canonical Node publisher, database lifecycle and public rendering in the real environment.',
})
const entries = [
  ['PX', 'post', 'dev'],
  ['BX', 'blog', 'dev'],
  ['CX', 'changelog', 'dev'],
  ['DX', 'doc', 'dev'],
  ['shared', 'post', 'dev'],
  ['deleteProbe', 'post', 'tmp'],
  ['zero', 'post', 'dev'],
  ['self', 'post', 'dev'],
  ['reviewImmediate', 'post', 'dev'],
  ['reviewAI', 'post', 'dev'],
  ['reviewHuman', 'post', 'mock'],
]
  .concat(Array.from({ length: 21 }, (_, index) => [`page${index + 1}`, 'post', 'dev']))
  .map(([alias, thread, community]) => ({
    alias,
    thread,
    community,
    title: `Acceptance ${alias}`,
    bodyBag,
  }))
const commands = Object.fromEntries(
  [
    ...entries.map((entry) => `article-${entry.alias}`),
    'mirror-shared',
    'mirror-deleteProbe',
    'comment-CM',
    'comment-sharedComment',
    'comment-deleteProbeComment',
    'comment-docComment',
    'ticket-create',
    'ticket-publish',
    'ticket-cleanup-withdraw',
  ].map((scene) => [scene, seedCommandId(runId, scene)]),
)
const revision = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
}
const path = resolve(output)
writeFileSync(
  path,
  JSON.stringify({ schemaVersion: 1, runId, revision, commands, entries, commentBodyBag: bodyBag }),
  {
    flag: 'wx',
    mode: 0o600,
  },
)
console.log(JSON.stringify({ output: path, schemaVersion: 1, entries: entries.length }))
