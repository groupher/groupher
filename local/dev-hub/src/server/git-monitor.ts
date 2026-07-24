import { execFile } from 'node:child_process'
import { watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import type { TGitDiffPayload, TGitDiffScope, TGitSnapshot } from '../shared/contracts.ts'

const execFileAsync = promisify(execFile)
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const GIT_MAX_BUFFER = 32 * 1024 * 1024
const REFRESH_DEBOUNCE_MS = 120
const RECONCILE_INTERVAL_MS = 5_000

const IGNORED_WORKTREE_PARTS = new Set([
  '.git',
  '.next',
  '.playwright',
  '.yarn',
  '_build',
  'coverage',
  'deps',
  'dist',
  'node_modules',
])

const RELEVANT_GIT_PATHS = [
  'HEAD',
  'CHERRY_PICK_HEAD',
  'MERGE_HEAD',
  'REVERT_HEAD',
  'index',
  'index.lock',
  'logs/',
  'packed-refs',
  'rebase-apply/',
  'rebase-merge/',
  'refs/',
]

type TGitSubscriber = (snapshot: TGitSnapshot) => void

export class GitMonitorError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 413 | 500 = 500,
  ) {
    super(message)
  }
}

export class GitMonitor {
  private readonly subscribers = new Set<TGitSubscriber>()
  private readonly watchers: FSWatcher[] = []
  private snapshot: TGitSnapshot = emptySnapshot()
  private gitDir = ''
  private revision = 0
  private refreshTimer: NodeJS.Timeout | null = null
  private reconcileTimer: NodeJS.Timeout | null = null
  private refreshing = false
  private refreshQueued = false
  private closed = false

  constructor(private readonly repoRoot: string) {}

  async initialize(): Promise<void> {
    this.gitDir = (await this.runGit(['rev-parse', '--absolute-git-dir'])).trim()
    await this.refreshNow()
    this.watchWorktree()
    this.watchGitDirectory()
    this.reconcileTimer = setInterval(() => {
      void this.refreshNow()
    }, RECONCILE_INTERVAL_MS)
    this.reconcileTimer.unref()
  }

  getSnapshot(): TGitSnapshot {
    return { ...this.snapshot }
  }

  subscribe(subscriber: TGitSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  async getPatch(scope: TGitDiffScope): Promise<TGitDiffPayload> {
    await this.refreshNow()

    const diffArgs = ['diff', '--no-ext-diff', '--no-color', '--find-renames']
    if (scope === 'all') diffArgs.push(this.snapshot.head ? 'HEAD' : EMPTY_TREE)
    if (scope === 'staged') diffArgs.push('--cached')
    diffArgs.push('--')

    try {
      const patch = await this.runGit(diffArgs)
      return { scope, patch, revision: this.snapshot.revision }
    } catch (error) {
      if (isMaxBufferError(error)) {
        throw new GitMonitorError('This diff is too large to preview in Dev Hub.', 413)
      }
      throw error
    }
  }

  close(): void {
    this.closed = true
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    if (this.reconcileTimer) clearInterval(this.reconcileTimer)
    this.refreshTimer = null
    this.reconcileTimer = null
    for (const watcher of this.watchers) watcher.close()
    this.watchers.length = 0
  }

  async refreshNow(): Promise<void> {
    if (this.closed) return
    if (this.refreshing) {
      this.refreshQueued = true
      return
    }

    this.refreshing = true
    try {
      const [statusOutput, numstatOutput] = await Promise.all([
        this.runGit([
          'status',
          '--porcelain=v2',
          '-z',
          '--branch',
          '--show-stash',
          '--untracked-files=all',
        ]),
        this.runGit([
          'diff',
          '--numstat',
          '-z',
          this.snapshot.head === null && this.revision > 0 ? EMPTY_TREE : 'HEAD',
          '--',
        ]).catch(async (error) => {
          if (await this.hasHead()) throw error
          return this.runGit(['diff', '--numstat', '-z', EMPTY_TREE, '--'])
        }),
      ])

      const next = parseGitSnapshot(statusOutput, numstatOutput)
      const previousComparable = JSON.stringify({ ...this.snapshot, revision: 0 })
      const nextComparable = JSON.stringify({ ...next, revision: 0 })

      if (previousComparable !== nextComparable) {
        this.snapshot = { ...next, revision: ++this.revision }
        for (const subscriber of this.subscribers) subscriber(this.getSnapshot())
      }
    } catch (error) {
      console.error('Could not refresh Git information.', error)
    } finally {
      this.refreshing = false
      if (this.refreshQueued) {
        this.refreshQueued = false
        this.scheduleRefresh()
      }
    }
  }

  private watchWorktree(): void {
    this.addWatcher(this.repoRoot, (filename) => {
      if (!filename || shouldRefreshWorktree(filename)) this.scheduleRefresh()
    })
  }

  private watchGitDirectory(): void {
    this.addWatcher(this.gitDir, (filename) => {
      if (!filename || shouldRefreshGitDirectory(filename)) this.scheduleRefresh()
    })
  }

  private addWatcher(directory: string, onChange: (filename: string | null) => void): void {
    try {
      const watcher = watch(directory, { recursive: true }, (_eventType, filename) => {
        onChange(filename === null ? null : filename.toString())
      })
      watcher.on('error', (error) => console.error(`Git watcher failed for ${directory}.`, error))
      this.watchers.push(watcher)
    } catch (error) {
      console.error(`Could not watch ${directory} for Git changes.`, error)
    }
  }

  private scheduleRefresh(): void {
    if (this.closed) return
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      void this.refreshNow()
    }, REFRESH_DEBOUNCE_MS)
    this.refreshTimer.unref()
  }

  private async hasHead(): Promise<boolean> {
    try {
      await this.runGit(['rev-parse', '--verify', 'HEAD'])
      return true
    } catch {
      return false
    }
  }

  private async runGit(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', ['-C', this.repoRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER,
    })
    return stdout
  }
}

export function parseGitSnapshot(statusOutput: string, numstatOutput: string): TGitSnapshot {
  const snapshot = emptySnapshot()
  const statusRecords = statusOutput.split('\0')

  for (let index = 0; index < statusRecords.length; index += 1) {
    const record = statusRecords[index]
    if (!record) continue

    if (record.startsWith('# branch.oid ')) snapshot.head = nullIfInitial(record.slice(13))
    else if (record.startsWith('# branch.head ')) snapshot.branch = nullIfDetached(record.slice(14))
    else if (record.startsWith('# branch.upstream ')) snapshot.upstream = record.slice(18)
    else if (record.startsWith('# branch.ab ')) {
      const match = /\+(\d+)\s+-(\d+)/.exec(record)
      if (match) {
        snapshot.ahead = Number(match[1])
        snapshot.behind = Number(match[2])
      }
    } else if (record.startsWith('# stash ')) snapshot.stashCount = Number(record.slice(8)) || 0
    else if (record[0] === '?') snapshot.untrackedFiles += 1
    else if (record[0] === 'u') {
      snapshot.conflictedFiles += 1
      snapshot.stagedFiles += 1
      snapshot.unstagedFiles += 1
    } else if (record[0] === '1' || record[0] === '2') {
      const x = record[2]
      const y = record[3]
      if (x && x !== '.') snapshot.stagedFiles += 1
      if (y && y !== '.') snapshot.unstagedFiles += 1
      if (record[0] === '2') index += 1
    }
  }

  const numstatRecords = numstatOutput.split('\0')
  for (let index = 0; index < numstatRecords.length; index += 1) {
    const record = numstatRecords[index]
    if (!record) continue

    const firstTab = record.indexOf('\t')
    const secondTab = record.indexOf('\t', firstTab + 1)
    if (firstTab === -1 || secondTab === -1) continue

    const additions = record.slice(0, firstTab)
    const deletions = record.slice(firstTab + 1, secondTab)
    const filename = record.slice(secondTab + 1)

    snapshot.changedFiles += 1
    if (additions === '-' || deletions === '-') snapshot.binaryFiles += 1
    else {
      snapshot.additions += Number(additions) || 0
      snapshot.deletions += Number(deletions) || 0
    }

    if (!filename) index += 2
  }

  return snapshot
}

function emptySnapshot(): TGitSnapshot {
  return {
    branch: null,
    head: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    stagedFiles: 0,
    unstagedFiles: 0,
    untrackedFiles: 0,
    conflictedFiles: 0,
    stashCount: 0,
    binaryFiles: 0,
    revision: 0,
  }
}

function nullIfInitial(value: string): string | null {
  return value === '(initial)' ? null : value
}

function nullIfDetached(value: string): string | null {
  return value === '(detached)' ? null : value
}

function shouldRefreshWorktree(filename: string): boolean {
  const parts = filename.split(/[\\/]/)
  return !parts.some((part) => IGNORED_WORKTREE_PARTS.has(part))
}

function shouldRefreshGitDirectory(filename: string): boolean {
  const normalized = filename.replaceAll('\\', '/')
  return RELEVANT_GIT_PATHS.some(
    (relevantPath) => normalized === relevantPath || normalized.startsWith(relevantPath),
  )
}

function isMaxBufferError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ('code' in error ? error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' : false)
  )
}
