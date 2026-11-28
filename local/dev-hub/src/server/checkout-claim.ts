import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, open, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

type TClaim = { version: 1; worktreeId: string; token: string }

const claimPath = (root: string) =>
  path.join(root, 'local', 'dev-hub', 'config', 'checkout-claim.json')

/** Create a private checkout claim exactly once; never adopt an existing file. */
export async function createCheckoutClaim(root: string, worktreeId: string): Promise<string> {
  if (!path.isAbsolute(root) || !/^[a-f0-9]{16}$/.test(worktreeId))
    throw new Error('Invalid checkout identity.')
  if ((await realpath(root)) !== root) throw new Error('Checkout root is not canonical.')
  const directory = path.dirname(claimPath(root))
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const claim: TClaim = { version: 1, worktreeId, token: randomBytes(32).toString('hex') }
  const file = await open(claimPath(root), 'wx', 0o600)
  try {
    await file.writeFile(`${JSON.stringify(claim)}\n`)
    await file.sync()
  } finally {
    await file.close()
  }
  return createHash('sha256').update(claim.token, 'hex').digest('hex')
}

/** Verify the exact private claim retained in the registered checkout. */
export async function verifyCheckoutClaim(
  root: string,
  worktreeId: string,
  expectedToken: string,
): Promise<void> {
  if (
    !path.isAbsolute(root) ||
    !/^[a-f0-9]{16}$/.test(worktreeId) ||
    !/^[a-f0-9]{64}$/.test(expectedToken)
  )
    throw new Error('Invalid registered checkout claim.')
  let claim: TClaim
  try {
    claim = JSON.parse(await readFile(claimPath(root), 'utf8')) as TClaim
  } catch (error) {
    throw new Error('Checkout claim is missing or unreadable; explicit recovery is required.', {
      cause: error,
    })
  }
  if (
    !claim ||
    claim.version !== 1 ||
    claim.worktreeId !== worktreeId ||
    typeof claim.token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(claim.token) ||
    !timingSafeEqual(
      createHash('sha256').update(claim.token, 'hex').digest(),
      Buffer.from(expectedToken, 'hex'),
    )
  ) {
    throw new Error(
      'Checkout claim does not match the registration; explicit recovery is required.',
    )
  }
}
