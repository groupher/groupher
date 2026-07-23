import type { TGitDiffScope, TGitSnapshot, TPublicService } from '@shared/contracts'

type TProps = {
  services: TPublicService[]
  git: TGitSnapshot | null
  connected: boolean
  onOpenDiff: (scope: TGitDiffScope) => void
}

export function PageHeader({ services, git, connected, onOpenDiff }: TProps) {
  const runningCount = services.filter((service) =>
    ['running', 'starting', 'external'].includes(service.status),
  ).length
  const branch = git?.branch || git?.head?.slice(0, 8) || 'no commits'
  const branchDistance = git && (git.ahead || git.behind) ? ` ↑${git.ahead} ↓${git.behind}` : ''
  const hasTrackedChanges = Boolean(git?.changedFiles)
  const hasStagedChanges = Boolean(git?.stagedFiles)

  return (
    <header className='site-header'>
      <a className='hub-mark' href='#top' aria-label='Groupher Dev Hub home'>
        <span>DEV</span>
        <span>HUB</span>
      </a>

      <div className='git-summary' aria-label='Git workspace summary'>
        <div className='git-summary-block'>
          <span className='git-summary-label'>Branch</span>
          <span className='git-summary-value git-summary-branch' title={branch}>
            {branch}
            {branchDistance}
          </span>
        </div>
        <button
          type='button'
          className='git-summary-block git-summary-button'
          disabled={!hasTrackedChanges}
          onClick={() => onOpenDiff('all')}
          aria-label='View all tracked changes'
        >
          <span className='git-summary-label'>Changes</span>
          <span className='git-summary-value git-summary-diff'>
            <span className='git-additions'>+{git?.additions || 0}</span>
            <span className='git-deletions'>−{git?.deletions || 0}</span>
          </span>
        </button>
        <button
          type='button'
          className='git-summary-block git-summary-button'
          disabled={!hasStagedChanges}
          onClick={() => onOpenDiff('staged')}
          aria-label='View staged changes'
        >
          <span className='git-summary-label'>Staged</span>
          <span className='git-summary-value'>{git?.stagedFiles || 0} files</span>
        </button>
        <div className='git-summary-block'>
          <span className='git-summary-label'>Untracked</span>
          <span className='git-summary-value'>{git?.untrackedFiles || 0} files</span>
        </div>
      </div>

      <div
        className={`header-summary ${connected ? 'is-connected' : ''}`}
        aria-label={`${connected ? 'Live' : 'Reconnecting'}, ${runningCount} active services, ${services.length} total services`}
      >
        <span className='connection-dot' aria-hidden='true' />
        <span>{runningCount} active</span>
        <span className='summary-separator'>/</span>
        <span>{services.length} total</span>
      </div>
    </header>
  )
}
