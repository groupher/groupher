import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from './salon'
import type { TPreviewProps } from './spec'

export default function MinimalPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={cnMerge(s.contentRow, 'items-start')}>
        <div className={s.upvoteBtn}>
          <UpvoteSVG className={s.upvoteIcon} />
          <div>N</div>
        </div>

        <div className={cnMerge(s.textColumn, 'grow pt-1')}>
          <div className={cnMerge(s.bar, s.minimalTitleBar)} />
          <div className={cnMerge(s.bar, s.minimalBodyWide)} />
          <div className={cnMerge(s.bar, s.minimalBodyTiny)} />
        </div>

        <CommentSVG className={cnMerge(s.upvoteIcon, 'size-3')} />
      </div>
    </div>
  )
}
