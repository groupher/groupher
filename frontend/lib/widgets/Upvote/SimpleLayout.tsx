/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import AnimatedCount from '../AnimatedCount'
import useUpvote from './useUpvote'
import UpvoteBtn from './UpvoteBtn'

import useSalon from './salon/simple_layout'

type TProps = {
  testid?: string
  count?: number
  viewerHasUpvoted?: boolean
  onAction?: (viewerHasUpvoted: boolean) => void
}

const Upvote: FC<TProps> = ({
  testid = 'upvote',
  count = 4,
  viewerHasUpvoted = false,
  onAction = console.log,
}) => {
  const s = useSalon({ viewerHasUpvoted })
  const { handleClick } = useUpvote({ viewerHasUpvoted, onAction })

  return (
    <button className={s.wrapper} data-testid={testid} onClick={() => handleClick()}>
      <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
      <AnimatedCount count={count} $active={viewerHasUpvoted} size="small" />
    </button>
  )
}

export default memo(Upvote)
