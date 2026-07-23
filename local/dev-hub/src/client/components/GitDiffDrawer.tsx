import { Dialog } from '@base-ui/react/dialog'
import type { TGitDiffScope, TGitSnapshot } from '@shared/contracts'
import { AlertCircle, GitCompareArrows, RefreshCw, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

import { fetchGitDiff } from '@/lib/hub-client'

const GitPatchView = lazy(() =>
  import('./GitPatchView').then((module) => ({ default: module.GitPatchView })),
)

type TProps = {
  scope: TGitDiffScope | null
  git: TGitSnapshot | null
  onScopeChange: (scope: TGitDiffScope) => void
  onClose: () => void
}

const SCOPE_LABEL: Record<TGitDiffScope, string> = {
  all: 'All changes',
  staged: 'Staged',
  unstaged: 'Unstaged',
}

export function GitDiffDrawer({ scope, git, onScopeChange, onClose }: TProps) {
  const [patch, setPatch] = useState('')
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const activeScope = scope || 'all'

  const refresh = useCallback(() => setRequestVersion((current) => current + 1), [])

  useEffect(() => {
    if (!scope) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    void fetchGitDiff(scope, controller.signal)
      .then((payload) => {
        setPatch(payload.patch)
        setLoadedRevision(payload.revision)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Could not load the Git diff.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [scope, requestVersion])

  const stale = loadedRevision !== null && git !== null && loadedRevision !== git.revision

  return (
    <Dialog.Root open={scope !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className='git-drawer-backdrop' />
        <Dialog.Viewport className='git-drawer-viewport'>
          <Dialog.Popup className='git-drawer-popup'>
            <header className='git-drawer-header'>
              <div className='git-drawer-title-group'>
                <GitCompareArrows aria-hidden='true' />
                <div>
                  <span className='git-drawer-kicker'>Workspace diff</span>
                  <Dialog.Title>{SCOPE_LABEL[activeScope]}</Dialog.Title>
                </div>
              </div>
              <Dialog.Close className='git-drawer-close' aria-label='Close Git diff'>
                <X aria-hidden='true' />
              </Dialog.Close>
            </header>

            <div className='git-drawer-toolbar'>
              <div className='git-drawer-tabs' role='tablist' aria-label='Diff scope'>
                {(Object.keys(SCOPE_LABEL) as TGitDiffScope[]).map((item) => (
                  <button
                    type='button'
                    role='tab'
                    aria-selected={activeScope === item}
                    className={activeScope === item ? 'is-active' : ''}
                    key={item}
                    onClick={() => onScopeChange(item)}
                  >
                    {SCOPE_LABEL[item]}
                  </button>
                ))}
              </div>
              <span className='git-drawer-scope-note'>Untracked files are listed separately.</span>
            </div>

            {stale ? (
              <div className='git-drawer-stale' role='status'>
                <span>The workspace changed while this diff was open.</span>
                <button type='button' onClick={refresh}>
                  <RefreshCw aria-hidden='true' /> Refresh
                </button>
              </div>
            ) : null}

            <div className='git-drawer-content'>
              {loading ? (
                <div className='git-drawer-state'>Preparing the diff…</div>
              ) : error ? (
                <div className='git-drawer-state is-error'>
                  <AlertCircle aria-hidden='true' />
                  <span>{error}</span>
                  <button type='button' onClick={refresh}>
                    Try again
                  </button>
                </div>
              ) : patch ? (
                <Suspense fallback={<div className='git-drawer-state'>Loading diff renderer…</div>}>
                  <GitPatchView patch={patch} revision={loadedRevision || 0} />
                </Suspense>
              ) : (
                <div className='git-drawer-state'>No changes in this scope.</div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
