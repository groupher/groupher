/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import AnimatedCount from '~/widgets/AnimatedCount'

import useSalon from './salon/article_layout'
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
  count = 0,
  viewerHasUpvoted = false,
  onAction = console.log,
}) => {
  const s = useSalon({ viewerHasUpvoted })
  const { handleUpvote } = useUpvote({ viewerHasUpvoted, onAction })

  return (
    <div className={s.wrapper} data-testid={testid}>
      <button type='button' className={s.button} onClick={handleUpvote}>
        <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
        <AnimatedCount count={count} active={viewerHasUpvoted} size='large' left={2} top={0.5} />
        <div className={s.alias}>票</div>
      </button>
    </div>
  )
}

export default memo(Upvote)
