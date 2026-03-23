import type { FC } from 'react'
import UpvoteSVG from '~/icons/Upvote'
import type { TColorName } from '~/spec'

import useSalon from '../../salon/compare_dev/our_way/upvote_counter'

type TProps = {
  text?: string
  num?: number
  color: TColorName
}

const UpdateCounter: FC<TProps> = ({ text = '投票', num = 13, color }) => {
  const s = useSalon({ color })

  return (
    <div className={s.wrapper}>
      <UpvoteSVG className={s.upvoteIcon} />
      <div className={s.text}>{text}</div>
      <div className={s.count}>{num}</div>
    </div>
  )
}

export default UpdateCounter
