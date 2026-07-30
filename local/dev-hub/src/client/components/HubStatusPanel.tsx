import type { TGitDiffScope, TGitSnapshot, TPublicService } from '@shared/contracts'
import { GitBranch } from 'lucide-react'

import { INFRA_PLATFORMS } from '@/lib/infra-links'

import { InfraPlatformMark } from './InfraPlatformMark'

type TProps = {
  services: TPublicService[]
  git: TGitSnapshot | null
  connected: boolean
  onOpenDiff: (scope: TGitDiffScope) => void
  onOpenInfra: () => void
}

export function HubStatusPanel({ services, git, connected, onOpenDiff, onOpenInfra }: TProps) {
  const activeCount = services.filter((service) =>
    ['running', 'starting', 'external'].includes(service.status),
  ).length
  const branch = git?.branch || git?.head?.slice(0, 8) || 'no commits'
  const hasTrackedChanges = Boolean(git?.changedFiles)

  return (
    <div
      className='hub-status-panel'
      aria-label={`Workspace and service status. ${connected ? 'Live' : 'Reconnecting'}. ${activeCount} services active, ${services.length} total services.`}
    >
      <button
        type='button'
        className='hub-status-block hub-status-button hub-status-git'
        disabled={!hasTrackedChanges}
        onClick={() => onOpenDiff('all')}
        aria-label={`View all tracked changes on ${branch}`}
      >
        <span className='hub-status-git-branch' title={branch}>
          <GitBranch aria-hidden='true' />
          <span>{branch}</span>
        </span>
        <span className='hub-status-value hub-status-diff'>
          <span className='git-additions'>+{git?.additions || 0}</span>
          <span className='git-deletions'>−{git?.deletions || 0}</span>
        </span>
      </button>
      <div className='hub-status-block'>
        <span className='hub-status-label'>Staged / Untracked</span>
        <span className='hub-status-value'>
          {git?.stagedFiles || 0} / {git?.untrackedFiles || 0} files
        </span>
      </div>
      <div className='hub-status-block hub-status-services'>
        <span className='hub-status-label'>Services</span>
        <span className='hub-status-value hub-status-service-value'>
          <span
            className={`connection-dot ${connected ? 'is-connected' : ''}`}
            aria-hidden='true'
          />
          <span>{activeCount}</span>
          <span className='summary-separator'>/</span>
          <span>{services.length}</span>
        </span>
      </div>
      <button
        type='button'
        className='hub-status-block hub-status-button hub-status-infra'
        onClick={onOpenInfra}
        aria-label='Open infra links'
      >
        <span className='hub-status-value hub-status-infra-value'>
          <span className='infra-summary-list'>
            {INFRA_PLATFORMS.map((platform) => (
              <span className='infra-summary-icon' key={`${platform.id}-icon`}>
                <InfraPlatformMark platform={platform} />
              </span>
            ))}
            {INFRA_PLATFORMS.map((platform) => (
              <span className='infra-summary-copy' key={`${platform.id}-copy`}>
                <span className='infra-summary-name'>{platform.name}</span>
                <span className='infra-summary-count'>{platform.links.length}</span>
              </span>
            ))}
          </span>
        </span>
      </button>
    </div>
  )
}
