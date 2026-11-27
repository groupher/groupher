import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createCheckoutClaim, verifyCheckoutClaim } from './checkout-claim.ts'

test('claim verifies the registered checkout and refuses path reuse', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-claim-')))
  const id = '0123456789abcdef'
  const file = path.join(root, 'local', 'dev-hub', 'config', 'checkout-claim.json')
  try {
    const token = await createCheckoutClaim(root, id)
    await verifyCheckoutClaim(root, id, token)
    assert.equal((await stat(file)).mode & 0o777, 0o600)
    await assert.rejects(createCheckoutClaim(root, id), { code: 'EEXIST' })
    await rm(file)
    await assert.rejects(verifyCheckoutClaim(root, id, token), /recovery/)
    const replacement = await createCheckoutClaim(root, id)
    assert.notEqual(token, replacement)
    await assert.rejects(verifyCheckoutClaim(root, id, token), /does not match/)
    await writeFile(file, 'null')
    await assert.rejects(verifyCheckoutClaim(root, id, replacement), /does not match/)
    assert.equal(await readFile(file, 'utf8'), 'null')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
