/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import AnimatedCount from '~/widgets/AnimatedCount'
import useSalon from './salon/simple_layout'
import UpvoteBtn from './UpvoteBtn'
import useUpvote from './useUpvote'

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
    <button type='button' className={s.wrapper} data-testid={testid} onClick={() => handleClick()}>
      <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
      <AnimatedCount count={count} $active={viewerHasUpvoted} size='small' />
    </button>
  )
}

export default memo(Upvote)
