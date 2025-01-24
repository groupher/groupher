/*
 *
 * Upvote
 *
 */
import { type FC, Fragment } from 'react'

import type { TUser } from '~/spec'

import Facepile from '~/widgets/Facepile'

import useUpvote from './useUpvote'
import AnimatedCount from '../AnimatedCount'
import UpvoteBtn from './UpvoteBtn'

import useSalon from './salon/default_layout'

type TProps = {
  testid?: string
  count?: number
  alias?: string
  viewerHasUpvoted?: boolean
  avatarList?: TUser[]
  onAction?: (viewerHasUpvoted: boolean) => void
}

const Upvote: FC<TProps> = ({
  testid = 'upvote',
  count = 4,
  alias = '参与了投票',
  viewerHasUpvoted = false,
  onAction = console.log,
  avatarList,
}) => {
  const s = useSalon({ viewerHasUpvoted })

  const { handleClick } = useUpvote({ viewerHasUpvoted, onAction })

  const noOne = count === 0
  const names = !noOne ? avatarList.map((user) => user.nickname).slice(0, 4) : []

  return (
    <div className={s.wrapper} data-testid={testid}>
      <button className={s.button} onClick={handleClick}>
        <UpvoteBtn viewerHasUpvoted={viewerHasUpvoted} count={count} />
        <AnimatedCount count={count} active={viewerHasUpvoted} size="large" left={2} />
      </button>
      {!noOne && (
        <div className={s.digest}>
          <Facepile users={avatarList} showMore={false} left={-4} bottom={3} top={3} />
          <div className={s.note}>
            {names.map((name, index) => (
              <Fragment key={name}>
                <div className={s.user}>{name}</div>
                {index !== names.length - 1 ? <>，</> : <>&nbsp;</>}
              </Fragment>
            ))}
            {alias}
          </div>
        </div>
      )}
    </div>
  )
}

export default Upvote
