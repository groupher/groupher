import assert from 'node:assert/strict'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { assertLegacyE2ECheckout } from '../../../../frontend/e2e/checkout-guard.ts'

test('legacy E2E listeners reject secondary checkouts before opening a listener', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'groupher-e2e-guard-')))
  const primary = path.join(base, 'primary')
  const secondary = path.join(base, 'secondary')
  const registry = path.join(base, 'registry')
  try {
    await Promise.all([mkdir(primary), mkdir(secondary), mkdir(registry)])
    await writeFile(path.join(secondary, '.git'), 'gitdir: /elsewhere')
    assert.doesNotThrow(() => assertLegacyE2ECheckout(primary, registry))
    assert.throws(() => assertLegacyE2ECheckout(secondary, registry), /linked worktrees/)
    await writeFile(
      path.join(registry, 'primary.json'),
      JSON.stringify({ version: 1, root: primary }),
    )
    assert.doesNotThrow(() => assertLegacyE2ECheckout(primary, registry))
    assert.throws(() => assertLegacyE2ECheckout(secondary, registry), /secondary checkouts/)
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})
