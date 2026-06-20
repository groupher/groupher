/*
 *
 * Facepile
 *
 */

import { compose, filter, isNil, not, reverse as reverseFn } from 'ramda'
import { type FC, Suspense } from 'react'

import SIZE from '~/const/size'
import type { TSpace, TUser } from '~/spec'
import ImgFallback from '~/widgets/ImgFallback'

import MoreItem from './MoreItem'
import RealAvatar from './RealAvatar'
import useSalon from './salon'
import type { TAvatarSize } from './spec'
import { cnMerge } from '~/css'

const validUser = compose(not, isNil)

const getUniqueArray = (arr, comp) => {
  const seen = new Set()
  const unique = []

  for (const item of arr) {
    const key = item?.[comp]
    if (seen.has(key)) continue

    seen.add(key)
    unique.push(item)
  }

  return unique
}

export type TProps = {
  users?: TUser[]
  size?: TAvatarSize
  total?: number | null
  limit?: number
  showMore?: boolean
  reverse?: boolean
  popCardPlacement?: 'top' | 'bottom'
  noLazyLoad?: boolean
  classNames?: string

  onUserSelect?: (user: TUser) => void
  onTotalSelect?: () => void
} & TSpace

const DEFAULT_USERS: TUser[] = []

const Facepile: FC<TProps> = ({
  size = SIZE.SMALL,
  total = null,
  users = DEFAULT_USERS,
  limit = 4,
  noLazyLoad = false,
  onUserSelect = console.log,
  onTotalSelect = console.log,
  showMore = true,
  reverse = false,
  popCardPlacement = 'bottom',
  classNames = '',
  ...spacing
}) => {
  const totalCount = total || users.length

  const s = useSalon({ total: totalCount, ...spacing })

  if (users.length === 0) {
    return <span />
  }

  const uniqueUsers = filter(validUser, getUniqueArray(users, 'login'))
  const sortedUsers = reverse ? reverseFn(uniqueUsers) : uniqueUsers

  // delete restProps?.forwardRef

  return (
    <ul className={cnMerge(s.wrapper, classNames)}>
      {totalCount === 1 ? (
        <Suspense fallback={<ImgFallback className={s.avatarFallback} user={sortedUsers[0]} />}>
          <RealAvatar
            isFirst
            isLast
            user={sortedUsers[0]}
            size={size}
            noLazyLoad={noLazyLoad}
            onUserSelect={onUserSelect}
            popCardPlacement={popCardPlacement}
          />
        </Suspense>
      ) : (
        <div className={s.avatars}>
          {sortedUsers.slice(0, limit).map((user, index) => (
            <Suspense
              key={user.login}
              fallback={<ImgFallback className={s.avatarFallback} user={user} />}
            >
              <RealAvatar
                isFirst={index === 0}
                isLast={index === limit}
                user={user}
                size={size}
                noLazyLoad={noLazyLoad}
                onUserSelect={onUserSelect}
                popCardPlacement={popCardPlacement}
              />
            </Suspense>
          ))}
        </div>
      )}

      {totalCount <= 1 || !showMore ? (
        <div className={s.totalOneOffset} />
      ) : (
        <MoreItem size={size} onTotalSelect={onTotalSelect} />
      )}
    </ul>
  )
}

export default Facepile
