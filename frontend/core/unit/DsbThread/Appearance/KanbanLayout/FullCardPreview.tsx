import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from './salon/item_card_layout'

type TProps = {
  isActive: boolean
}

export default function FullCardPreview({ isActive }: TProps) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.header}>
          <div className={cnMerge(s.bar, s.titleBar)} />
          <div className={s.headerRow}>
            <div className={cnMerge(s.bar, s.bodyBar)} />
            <div className={cnMerge(s.bar, s.sideBar)} />
          </div>
        </div>

        <div className={s.footer}>
          <div className={s.footerLeft}>
            <UpvoteSVG className={s.icon} />
            <div className={s.avatarList}>
              <div className={s.userAvatar} />
              <div className={cnMerge(s.userAvatar, 'opacity-30')} />
              <div className={cnMerge(s.userAvatar, 'opacity-20')} />
            </div>
          </div>

          <div className={s.footerRight}>
            <CommentSVG className={s.commentIcon} />
            <div className={cnMerge(s.bar, s.tinyMetric)} />
          </div>
        </div>
      </div>
    </div>
  )
}
