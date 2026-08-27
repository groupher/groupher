import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from './salon'
import type { TPreviewProps } from './spec'

export default function CoverPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.contentRow}>
        <div className={cnMerge(s.bar, s.coverMedia)} />

        <div className={cnMerge(s.frame, 'grow')}>
          <div className={s.header}>
            <div className={cnMerge(s.bar, s.coverMeta)} />
            <div className={cnMerge(s.bar, s.coverTitle)} />
          </div>

          <div className={s.footer}>
            <div className={s.footerLeft}>
              <UpvoteSVG className={s.upvoteIcon} />
              <div className={cnMerge(s.bar, s.coverScore)} />
            </div>
            <div className={s.footerRight}>
              <CommentSVG className={cnMerge(s.upvoteIcon, 'size-3.5')} />
              <div className={cnMerge(s.bar, s.coverNote)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
