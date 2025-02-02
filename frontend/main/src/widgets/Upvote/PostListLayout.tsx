/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import AnimatedCount from '~/widgets/AnimatedCount'

import useUpvote from './useUpvote'
import UpvoteBtn from './UpvoteBtn'
import useSalon from './salon/post_list_layout'

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
  const s = useSalon()
  const { handleClick } = useUpvote({ viewerHasUpvoted, onAction })

  return (
    <button className={s.wrapper} data-testid={testid} onClick={handleClick}>
      <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
      <AnimatedCount count={count} active={viewerHasUpvoted} />
    </button>
  )
}

export default memo(Upvote)
