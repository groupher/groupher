/** Builds canonical reference bodies from the seed manifest's public URLs. */
import { readFileSync, writeFileSync } from 'node:fs'

import { publishArtiment } from '../packages/content-publisher/index'
import { seedCommandId } from './production-seed-identity.mts'
const [manifestFile, output] = process.argv.slice(2)
if (!manifestFile || !output)
  throw new Error('Usage: production-seed-links.mts MANIFEST.json OUTPUT.json')
const decoded = JSON.parse(readFileSync(manifestFile, 'utf8'))
const manifest = decoded.result || decoded
if (!manifest.runId || !manifest.resources || !manifest.contentChecksum)
  throw new Error('A seed manifest is required')
const pairs = [
  ['PX', 'BX'],
  ['BX', 'CX'],
  ['CX', 'DX'],
  ['DX', 'TX'],
  ['TX', 'CM'],
  ['CM', 'PX'],
  ['self', 'self'],
]
const entries = []
for (const [source, target] of pairs) {
  const targets =
    source === 'PX'
      ? [target, 'PX', ...Array.from({ length: 21 }, (_, index) => `page${index + 1}`)]
      : [target]
  const links = targets.map((alias) => {
    const url = manifest.resources[alias]?.url
    if (typeof url !== 'string' || !url.startsWith('/'))
      throw new Error(`Missing canonical URL for ${alias}`)
    return `https://groupher.com${url}`
  })
  const bodyBag = await publishArtiment([
    {
      type: 'p',
      children: [
        {
          text: `Production acceptance source ${source}. Canonical references exercise public visibility and deterministic targets.`,
        },
      ],
    },
    ...links.map((url) => ({ type: 'p', children: [{ text: url }] })),
  ])
  entries.push({
    alias: source,
    bodyBag,
    commandId: seedCommandId(manifest.runId, `reference-${source}`),
    commands: Object.fromEntries(
      ['ensure', 'save', 'publish'].map((action) => [
        action,
        seedCommandId(manifest.runId, `reference-${source}-${action}`),
      ]),
    ),
  })
}
writeFileSync(
  output,
  JSON.stringify({
    schemaVersion: 1,
    runId: manifest.runId,
    contentChecksum: manifest.contentChecksum,
    entries,
  }),
  { mode: 0o600, flag: 'wx' },
)
console.log(JSON.stringify({ output, sources: entries.length }))
