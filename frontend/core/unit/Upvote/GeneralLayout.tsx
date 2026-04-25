/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import type { TUser } from '~/spec'
import AnimatedCount from '~/widgets/AnimatedCount'
import Facepile from '~/widgets/Facepile'
import useSalon, { cn } from './salon/general_layout'
import UpvoteBtn from './UpvoteBtn'
import useUpvote from './useUpvote'

type TProps = {
  testid?: string
  count?: number
  viewerHasUpvoted?: boolean
  avatarList?: TUser[]
  onAction?: (viewerHasUpvoted: boolean) => void
}

const Upvote: FC<TProps> = ({
  testid: _testid = 'upvote',
  count = 4,
  viewerHasUpvoted = false,
  onAction = console.log,
  avatarList,
}) => {
  const s = useSalon({ viewerHasUpvoted })

  const { handleClick } = useUpvote({ viewerHasUpvoted, onAction })
  const noOne = count === 0

  return (
    <div className={s.wrapper}>
      <button type='button' className={cn(s.button)} onClick={handleClick}>
        <div className={s.upvote}>
          <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
        </div>
        <AnimatedCount
          left={1}
          count={count}
          active={viewerHasUpvoted}
          size={count === 0 ? 'small' : 'medium'}
        />
      </button>
      {!noOne && (
        <div className={cn(s.lineDivider, !viewerHasUpvoted && count > 0 ? 'ml-1' : 'ml-3')} />
      )}
      {!noOne && <Facepile users={avatarList} showMore />}
    </div>
  )
}

export default memo(Upvote)
