/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import AnimatedCount from '~/widgets/AnimatedCount'

import useUpvote from './useUpvote'
import UpvoteBtn from './UpvoteBtn'
import useSalon from './salon/article_layout'

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
    <div className={s.wrapper} data-testid={testid}>
      <button className={s.button} onClick={handleClick}>
        <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
        <AnimatedCount count={count} active={viewerHasUpvoted} size="large" left={2} top={0.5} />
        <div className={s.alias}>票</div>
      </button>
    </div>
  )
}

export default memo(Upvote)
