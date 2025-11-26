import type { FC } from 'react'
import ArchivedSVG from '~/icons/Archived'
import CommentSVG from '~/icons/Comment'
import ShareSVG from '~/icons/Share'
import DeleteSVG from '~/icons/Trash'
import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cn } from '../../salon/battery_bento/mobile_first/action_mask'

type TProps = {
  hovering: boolean
}

const ActionsMask: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, !hovering ? '-bottom-24' : '-bottom-1')}>
      <div className={s.top}>
        <div className={s.actionBlock}>
          <UpvoteSVG className={cn(s.icon, 'size-5 brightness-90', s.fillOrange)} />
        </div>
        <div className={s.actionBlock}>
          <CommentSVG className={s.icon} />
        </div>
        <div className={s.actionBlock}>
          <ShareSVG className={s.icon} />
        </div>
      </div>
      <div className={s.bottomActions}>
        <div className={s.menuItem}>
          <ArchivedSVG className={s.icon} />
          <div className={cn(s.bar, 'w-12')} />
        </div>
        <div className={s.menuItem}>
          <DeleteSVG className={s.icon} />
          <div className={s.bar} />
        </div>
      </div>
    </div>
  )
}

export default ActionsMask
