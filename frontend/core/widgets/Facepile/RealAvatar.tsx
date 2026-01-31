import type { FC } from 'react'
import Img from '~/Img'
import type { TUser } from '~/spec'
import UserCard from '~/widgets/Cards/UserCard'
import ImgFallback from '~/widgets/ImgFallback'
import Tooltip from '~/widgets/Tooltip'

import useSalon from './salon/real_avatar'
import type { TAvatarSize } from './spec'

type TProps = {
  isFirst: boolean
  isLast: boolean
  user?: TUser
  size?: TAvatarSize
  noLazyLoad: boolean
  popCardPlacement?: 'top' | 'bottom'
  onUserSelect: (user: TUser) => void
}

const RealAvatar: FC<TProps> = ({
  isFirst,
  isLast,
  user,
  size,
  noLazyLoad,
  onUserSelect,
  popCardPlacement,
}) => {
  const s = useSalon({ size, isFirst, isLast })

  return (
    <li className={s.wrapper}>
      <Tooltip
        content={<UserCard user={user} />}
        delay={0}
        placement={popCardPlacement}
        interactive={false}
      >
        <Img
          src={user.avatar}
          className={s.avatar}
          onClick={() => onUserSelect(user)}
          noLazy={noLazyLoad}
          fallback={<ImgFallback className={s.avatarFallback} user={user} />}
        />
      </Tooltip>
    </li>
  )
}

export default RealAvatar
