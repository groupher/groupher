import { createHash } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

export const worktreeId = (repoRoot: string) =>
  createHash('sha256').update(path.resolve(repoRoot)).digest('hex').slice(0, 16)

export const userDataBase = (
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
  home: string,
) => {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support')
  if (platform === 'win32') return environment.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
  const xdgDataHome = environment.XDG_DATA_HOME
  return xdgDataHome && path.isAbsolute(xdgDataHome)
    ? xdgDataHome
    : path.join(home, '.local', 'share')
}

export const userDataRoot = (repoRoot: string) =>
  path.join(
    userDataBase(process.platform, process.env, homedir()),
    'Groupher',
    'DevHub',
    worktreeId(repoRoot),
  )

export const workerRoot = (repoRoot: string) =>
  path.join(tmpdir(), 'groupher-dev-hub', worktreeId(repoRoot), 'workers')

export const workerStateRoot = (repoRoot: string) =>
  path.join(userDataRoot(repoRoot), 'worker-state')
