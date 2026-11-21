import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, appendFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

test('generation check rejects changed output without mutating the workspace', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'groupher-trash-contract-'))
  try {
    for (const directory of ['packages/contracts/scripts', 'packages/contracts/src', 'backend/api/config', 'backend/api/lib/groupher_server/cms']) {
      await mkdir(join(temporary, directory), { recursive: true })
    }
    for (const name of ['packages/contracts/scripts/generate-community-article-trash-contract.mjs', 'packages/contracts/community-article-trash.contract.json', 'backend/api/config/config.exs']) {
      await copyFile(join(repoRoot, name), join(temporary, name))
    }
    const script = join(temporary, 'packages/contracts/scripts/generate-community-article-trash-contract.mjs')
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
    assert.equal(run().status, 0)
    assert.equal(run('--check').status, 0)
    await appendFile(join(temporary, 'packages/contracts/src/community-article-trash.generated.ts'), '\n// stale\n')
    assert.notEqual(run('--check').status, 0)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
