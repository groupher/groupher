/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import useSalon from './salon/fixed_header_layout'
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
    <div className={s.wrapper} data-testid={testid} onClick={handleClick}>
      <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
      <div className={s.count}>{count}</div>
    </div>
  )
}

export default memo(Upvote)
