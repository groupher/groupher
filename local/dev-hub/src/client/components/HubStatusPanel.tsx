import type { TGitDiffScope, TGitSnapshot, TPublicService } from '@shared/contracts'

type TProps = {
  services: TPublicService[]
  git: TGitSnapshot | null
  connected: boolean
  onOpenDiff: (scope: TGitDiffScope) => void
}

export function HubStatusPanel({ services, git, connected, onOpenDiff }: TProps) {
  const activeCount = services.filter((service) =>
    ['running', 'starting', 'external'].includes(service.status),
  ).length
  const branch = git?.branch || git?.head?.slice(0, 8) || 'no commits'
  const branchDistance = git && (git.ahead || git.behind) ? ` ↑${git.ahead} ↓${git.behind}` : ''
  const hasTrackedChanges = Boolean(git?.changedFiles)
  const hasStagedChanges = Boolean(git?.stagedFiles)

  return (
    <div
      className='hub-status-panel'
      aria-label={`Workspace and service status. ${connected ? 'Live' : 'Reconnecting'}. ${activeCount} active services, ${services.length} total services.`}
    >
      <div className='hub-status-block'>
        <span className='hub-status-label'>Branch</span>
        <span className='hub-status-value hub-status-branch' title={branch}>
          {branch}
          {branchDistance}
        </span>
      </div>
      <button
        type='button'
        className='hub-status-block hub-status-button'
        disabled={!hasTrackedChanges}
        onClick={() => onOpenDiff('all')}
        aria-label='View all tracked changes'
      >
        <span className='hub-status-label'>Changes</span>
        <span className='hub-status-value hub-status-diff'>
          <span className='git-additions'>+{git?.additions || 0}</span>
          <span className='git-deletions'>−{git?.deletions || 0}</span>
        </span>
      </button>
      <button
        type='button'
        className='hub-status-block hub-status-button'
        disabled={!hasStagedChanges}
        onClick={() => onOpenDiff('staged')}
        aria-label='View staged changes'
      >
        <span className='hub-status-label'>Staged</span>
        <span className='hub-status-value'>{git?.stagedFiles || 0} files</span>
      </button>
      <div className='hub-status-block'>
        <span className='hub-status-label'>Untracked</span>
        <span className='hub-status-value'>{git?.untrackedFiles || 0} files</span>
      </div>
      <div className='hub-status-block hub-status-services'>
        <span className='hub-status-label'>Services</span>
        <span className='hub-status-value hub-status-service-value'>
          <span
            className={`connection-dot ${connected ? 'is-connected' : ''}`}
            aria-hidden='true'
          />
          <span>{activeCount} active</span>
          <span className='summary-separator'>/</span>
          <span>{services.length} total</span>
        </span>
      </div>
    </div>
  )
}
