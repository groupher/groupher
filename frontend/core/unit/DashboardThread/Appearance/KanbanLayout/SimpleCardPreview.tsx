import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from './salon/item_card_layout'

type TProps = {
  isActive: boolean
}

export default function SimpleCardPreview({ isActive }: TProps) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.header}>
          <div className={cnMerge(s.bar, s.titleBar)} />
          <div className={cnMerge(s.bar, s.bodyBar)} />
        </div>

        <div className={s.footer}>
          <div className={s.footerLeft}>
            <UpvoteSVG className={s.icon} />
            <CommentSVG className={s.commentIcon} />
          </div>
          <div className={cnMerge(s.bar, s.simpleMetric)} />
        </div>
      </div>
    </div>
  )
}
