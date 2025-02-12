/*
 *
 * Facepile
 *
 */

import { type FC, Suspense, lazy } from 'react'
import { compose, not, isNil, filter, reverse as reverseFn, slice } from 'ramda'

import type { TUser, TSpace } from '~/spec'
import { AVATARS_LIST_LENGTH } from '~/config'

import SIZE from '~/const/size'

import ImgFallback from '~/widgets/ImgFallback'

import type { TAvatarSize } from './spec'
import MoreItem from './MoreItem'

import { getAvatarSize } from './salon/metric'
import useSalon from './salon'

const RealAvatar = lazy(() => import('./RealAvatar'))

const validUser = compose(not, isNil)

const getUniqueArray = (arr, comp) => {
  const unique = arr
    .map((e) => e[comp])

    // store the keys of the unique objects
    .map((e, i, final) => final.indexOf(e) === i && i)

    // eliminate the dead keys & store unique objects
    .filter((e) => arr[e])
    .map((e) => arr[e])

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

  onUserSelect?: (user: TUser) => void
  onTotalSelect?: () => void
} & TSpace

const Facepile: FC<TProps> = ({
  size = SIZE.SMALL,
  total = null,
  users = [],
  limit = AVATARS_LIST_LENGTH.POSTS,
  noLazyLoad = false,
  onUserSelect = console.log,
  onTotalSelect = console.log,
  showMore = true,
  reverse = false,
  popCardPlacement = 'bottom',
  ...spacing
}) => {
  const totalCount = total || users.length

  const s = useSalon({ total: totalCount, ...spacing })

  if (users.length === 0) {
    return <span />
  }

  users = filter(validUser, getUniqueArray(users, 'login'))
  const sortedUsers = reverse ? reverseFn(users) : users

  // delete restProps?.forwardRef

  return (
    <ul className={s.wrapper}>
      {totalCount === 1 ? (
        <Suspense
          fallback={
            <ImgFallback
              className={s.avatarFallback}
              size={getAvatarSize(size, 'number') as number}
              user={sortedUsers[0]}
            />
          }
        >
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
          {slice(0, limit, sortedUsers).map((user, index) => (
            <Suspense
              key={user.login}
              fallback={
                <ImgFallback
                  className={s.avatarFallback}
                  size={getAvatarSize(size, 'number') as number}
                  user={user}
                />
              }
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
