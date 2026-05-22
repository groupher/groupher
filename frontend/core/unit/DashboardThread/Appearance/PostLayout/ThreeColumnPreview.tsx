import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from './salon'
import type { TPreviewProps } from './spec'

export default function ThreeColumnPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={cnMerge(s.contentRow, 'items-start')}>
        <div className={cnMerge(s.userAvatar, 'mt-0.5')} />

        <div className={cnMerge(s.textColumn, 'grow pt-1')}>
          <div className={cnMerge(s.bar, s.phTitleBar)} />
          <div className={cnMerge(s.bar, s.phBodyWide)} />
          <div className={cnMerge(s.bar, s.phBodyTiny)} />
        </div>

        <div className={cnMerge(s.upvoteBtn, compact ? '-mt-0.5' : 'scale-90 -mt-1')}>
          <UpvoteSVG className={s.upvoteIcon} />
          <div>N</div>
        </div>
      </div>
    </div>
  )
}
