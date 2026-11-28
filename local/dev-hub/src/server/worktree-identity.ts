import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type TCheckoutIdentity = {
  root: string
  commonDir: string
  mainRoot: string
  isMainWorktree: boolean
  worktreeId: string
}

/** Resolve checkout identity from Git and the filesystem, independent of the current branch. */
export async function resolveCheckout(cwd: string): Promise<TCheckoutIdentity> {
  const git = async (...args: string[]) => {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
    return stdout.trim()
  }

  const root = await realpath(await git('rev-parse', '--show-toplevel'))
  const commonDir = await realpath(
    await git('rev-parse', '--path-format=absolute', '--git-common-dir'),
  )
  const listing = await git('worktree', 'list', '--porcelain', '-z')
  const mainLine = listing.split('\0').find((line) => line.startsWith('worktree '))
  if (!mainLine) throw new Error('Git did not identify the main worktree.')
  const mainRoot = await realpath(mainLine.slice('worktree '.length))
  return {
    root,
    commonDir,
    mainRoot,
    isMainWorktree: root === mainRoot,
    worktreeId: createHash('sha256').update(root).digest('hex').slice(0, 16),
  }
}

/** Generate a hostname component; append a stable suffix when an existing slug collides. */
export function checkoutSlug(identity: TCheckoutIdentity, collision = false): string {
  const name = path.basename(identity.root).replace(/^groupher-/i, '')
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const prefix = normalized.slice(0, 30).replace(/-+$/g, '') || 'worktree'
  return collision ? `${prefix}-${identity.worktreeId.slice(0, 8)}` : prefix
}
