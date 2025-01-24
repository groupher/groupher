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

import useSalon from './salon/comment_layout'

type TProps = {
  testid?: string
  count?: number
  alias?: string
  viewerHasUpvoted?: boolean
  onAction?: (viewerHasUpvoted: boolean) => void
}

const Upvote: FC<TProps> = ({
  testid = 'upvote',
  alias = '赞同',
  count = 0,
  viewerHasUpvoted = false,
  onAction = console.log,
}) => {
  const s = useSalon({ viewerHasUpvoted })
  const { handleClick } = useUpvote({ viewerHasUpvoted, onAction })

  return (
    <div className={s.wrapper} data-testid={testid}>
      <button className={s.button} onClick={handleClick}>
        <UpvoteBtn type={UPVOTE_LAYOUT.COMMENT} viewerHasUpvoted={viewerHasUpvoted} count={count} />
        <div className={s.alias}>{alias}</div>
        {count !== 0 && <AnimatedCount count={count} active={viewerHasUpvoted} size="medium" />}
      </button>
    </div>
  )
}

export default memo(Upvote)
