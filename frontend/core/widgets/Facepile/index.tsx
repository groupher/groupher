import type { FC } from 'react'

import SIZE from '~/const/size'
import { cnMerge } from '~/css'
import type { TSpace, TUser } from '~/spec'

import AvatarItem from './AvatarItem'
import MoreItem from './MoreItem'
import useSalon from './salon'
import type { TAvatarSize } from './spec'

type TDisplayUser = {
  key: string
  user: TUser
}

const getUserKey = (user: TUser): string | null => {
  return (
    user.login ||
    user.id ||
    user.extraId ||
    user.email ||
    user.avatar ||
    user.nickname ||
    user.name ||
    null
  )
}

const getDisplayUsers = (users: TUser[]): TDisplayUser[] => {
  const seen = new Set()
  const uniqueUsers: TDisplayUser[] = []

  for (const user of users) {
    if (!user) continue

    const key = getUserKey(user)
    if (!key) continue
    if (seen.has(key)) continue

    seen.add(key)
    uniqueUsers.push({ key, user })
  }

  return uniqueUsers
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
  onUserSelect,
  onTotalSelect,
  showMore = true,
  reverse = false,
  popCardPlacement = 'bottom',
  classNames = '',
  ...spacing
}) => {
  const displayUsers = getDisplayUsers(users)
  const sortedUsers = reverse ? [...displayUsers].reverse() : displayUsers
  const visibleUsers = sortedUsers.slice(0, Math.max(limit, 0))
  const totalCount = total ?? users.length
  const showMoreItem = showMore && totalCount > 1

  const s = useSalon({ total: totalCount, ...spacing })

  if (visibleUsers.length === 0) {
    return null
  }

  return (
    <ul className={cnMerge(s.wrapper, classNames)}>
      {visibleUsers.map(({ key, user }, index) => (
        <AvatarItem
          key={key}
          isFirst={index === 0}
          isLast={index === visibleUsers.length - 1 && !showMoreItem}
          user={user}
          size={size}
          noLazyLoad={noLazyLoad}
          onUserSelect={onUserSelect}
          popCardPlacement={popCardPlacement}
        />
      ))}

      {showMoreItem && <MoreItem size={size} onTotalSelect={onTotalSelect} />}
    </ul>
  )
}

export default Facepile
