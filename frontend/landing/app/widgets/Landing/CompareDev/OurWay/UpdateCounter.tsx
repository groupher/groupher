import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import UpvoteSVG from '~/icons/Upvote'
import type { TColorName } from '~/spec'

import useSalon from '../../salon/compare_dev/our_way/upvote_counter'

type TProps = {
  text?: string
  num?: number
  color: TColorName
}

const UpdateCounter: FC<TProps> = ({ text, num = 13, color }) => {
  const s = useSalon({ color })
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <UpvoteSVG className={s.upvoteIcon} />
      <div className={s.text}>{text ?? t('landing.compare.vote')}</div>
      <div className={s.count}>{num}</div>
    </div>
  )
}

export default UpdateCounter
