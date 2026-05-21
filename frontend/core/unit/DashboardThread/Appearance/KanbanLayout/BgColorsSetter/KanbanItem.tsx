import type { FC } from 'react'

import { KANBAN_CARD_LAYOUT } from '~/const/layout'
import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from '../salon/bg_colors_setter/kanban_item'

type TProps = {
  layout: (typeof KANBAN_CARD_LAYOUT)[keyof typeof KANBAN_CARD_LAYOUT]
  opacity?: string
  width?: string
}

const KanbanItem: FC<TProps> = ({ layout, opacity = 'opacity-100', width = 'w-20' }) => {
  const s = useSalon()

  return (
    <div className={cnMerge(s.wrapper, opacity)}>
      {layout === KANBAN_CARD_LAYOUT.FULL ? (
        <div className={s.frame}>
          <div className={s.header}>
            <div className={cnMerge(s.bar, s.titleBar)} />
            <div className={s.headerRow}>
              <div className={cnMerge(s.bar, s.bodyBar, width)} />
              <div className={cnMerge(s.bar, s.sideBar)} />
            </div>
          </div>

          <div className={s.footer}>
            <div className={s.footerLeft}>
              <UpvoteSVG className={s.icon} />
              <div className={s.avatarList}>
                <div className={s.userAvatar} />
                <div className={cnMerge(s.userAvatar, 'opacity-20')} />
                <div className={cnMerge(s.userAvatar, 'opacity-15')} />
              </div>
            </div>
            <div className={s.footerRight}>
              <CommentSVG className={s.commentIcon} />
              <div className={cnMerge(s.bar, s.tinyMetric)} />
            </div>
          </div>
        </div>
      ) : (
        <div className={s.frame}>
          <div className={s.header}>
            <div className={cnMerge(s.bar, s.titleBar)} />
            <div className={cnMerge(s.bar, s.bodyBar, width)} />
          </div>

          <div className={s.footer}>
            <div className={s.footerLeft}>
              <UpvoteSVG className={s.icon} />
            </div>
            <div className={s.footerRight}>
              <div className={cnMerge(s.bar, s.simpleMetric)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KanbanItem
