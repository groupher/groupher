/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import type { TUser } from '~/spec'

import { UPVOTE_LAYOUT } from '~/const/layout'
import AnimatedCount from '~/widgets/AnimatedCount'
import Facepile from '~/widgets/Facepile'

import useUpvote from './useUpvote'
import UpvoteBtn from './UpvoteBtn'
import useSalon from './salon/sticker_layout'

type TProps = {
  testid?: string
  count?: number
  viewerHasUpvoted?: boolean
  onAction?: (viewerHasUpvoted: boolean) => void
  avatarList: TUser[]
}

const Upvote: FC<TProps> = ({
  testid = 'upvote',
  count = 0,
  viewerHasUpvoted = false,
  onAction = console.log,
  avatarList = [],
}) => {
  const s = useSalon({ viewerHasUpvoted })

  const { handleClick } = useUpvote({ viewerHasUpvoted, onAction })
  const noOne = count === 0

  return (
    <div className={s.wrapper} data-testid={testid}>
      <button className={s.button} onClick={handleClick}>
        <UpvoteBtn type={UPVOTE_LAYOUT.COMMENT} viewerHasUpvoted={viewerHasUpvoted} count={count} />
        <AnimatedCount
          count={count}
          active={viewerHasUpvoted}
          size="medium"
          top={0.5}
          bottom={0.5}
        />
      </button>
      {!noOne && <Facepile users={avatarList} showMore={false} limit={3} />}
    </div>
  )
}

export default memo(Upvote)
