/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import AnimatedCount from '~/widgets/AnimatedCount'

import useUpvote from './useUpvote'
import UpvoteBtn from './UpvoteBtn'

import useSalon from './salon/post_minimal_layout'

type TProps = {
  testid?: string
  count?: number
  viewerHasUpvoted?: boolean
  onAction?: (viewerHasUpvoted: boolean) => void
}

const Upvote: FC<TProps> = ({
  testid = 'upvote',
  count = 0,
  viewerHasUpvoted = false,
  onAction = console.log,
}) => {
  const s = useSalon({ viewerHasUpvoted })
  const { handleClick } = useUpvote({ viewerHasUpvoted, onAction })

  return (
    <button data-testid={testid} className={s.button} onClick={() => handleClick()}>
      <UpvoteBtn type={UPVOTE_LAYOUT.COMMENT} viewerHasUpvoted={viewerHasUpvoted} count={count} />
      <AnimatedCount count={count} active={viewerHasUpvoted} size="medium" />
    </button>
  )
}

export default memo(Upvote)
