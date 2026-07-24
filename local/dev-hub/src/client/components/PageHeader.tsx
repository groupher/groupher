import type { TGitDiffScope, TGitSnapshot, TPublicService } from '@shared/contracts'

import type { THubViewMode } from '@/spec'

import { HubStatusPanel } from './HubStatusPanel'
import { ViewModeSwitch } from './ViewModeSwitch'

type TProps = {
  services: TPublicService[]
  git: TGitSnapshot | null
  connected: boolean
  viewMode: THubViewMode
  onOpenDiff: (scope: TGitDiffScope) => void
  onViewModeChange: (mode: THubViewMode) => void
}

export function PageHeader({
  services,
  git,
  connected,
  viewMode,
  onOpenDiff,
  onViewModeChange,
}: TProps) {
  return (
    <header className='site-header'>
      <a className='hub-mark' href='#top' aria-label='Groupher Dev Hub home'>
        <span>DEV</span>
        <span>HUB</span>
      </a>

      <HubStatusPanel services={services} git={git} connected={connected} onOpenDiff={onOpenDiff} />
      <ViewModeSwitch value={viewMode} onChange={onViewModeChange} />
    </header>
  )
}
