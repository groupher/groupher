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
  const { handleUpvote } = useUpvote({ viewerHasUpvoted, onAction })

  return (
    <button type='button' className={s.wrapper} data-testid={testid} onClick={handleUpvote}>
      <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
      <div className={s.count}>{count}</div>
    </button>
  )
}

export default memo(Upvote)
