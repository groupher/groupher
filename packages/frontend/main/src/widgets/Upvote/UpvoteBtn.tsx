/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import type { TUpvoteLayout } from '~/spec'

import UpvoteIcon from '~/icons/Upvote'
import useSalon from './salon/upvote_btn'

type TProps = {
  type?: TUpvoteLayout
  viewerHasUpvoted?: boolean
  count?: number
}

const UpvoteBtn: FC<TProps> = ({ type = 'default', viewerHasUpvoted = false, count = 0 }) => {
  const s = useSalon({ viewerHasUpvoted })

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <UpvoteIcon className={s.upIcon} />
      </div>
    </div>
  )
}

export default memo(UpvoteBtn)
