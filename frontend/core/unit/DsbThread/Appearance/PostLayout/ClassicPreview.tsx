import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from './salon'
import type { TPreviewProps } from './spec'

export default function ClassicPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.topRow}>
          <div className={s.header}>
            <div className={cnMerge(s.bar, s.metaBar)} />
            <div className={cnMerge(s.bar, s.titleBar)} />
            <div className={cnMerge(s.bar, s.bodyWide)} />
          </div>
          <CommentSVG className={s.commentIcon} />
        </div>

        <div className={s.footer}>
          <div className={s.footerLeft}>
            <UpvoteSVG className={s.upvoteIcon} />
            <div className={cnMerge(s.bar, s.scoreBar)} />
            <div className={cnMerge(s.bar, s.noteBar)} />
          </div>
        </div>
      </div>
    </div>
  )
}
