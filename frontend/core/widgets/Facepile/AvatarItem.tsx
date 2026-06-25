import Image from 'next/image'
import { type FC, useState } from 'react'

import type { TUser } from '~/spec'
import UserCard from '~/widgets/Cards/UserCard'
import ImgFallback from '~/widgets/ImgFallback'
import Tooltip from '~/widgets/Tooltip'

import useSalon from './salon/avatar_item'
import type { TAvatarSize } from './spec'

type TProps = {
  isFirst: boolean
  isLast: boolean
  user?: TUser
  size?: TAvatarSize
  noLazyLoad: boolean
  popCardPlacement?: 'top' | 'bottom'
  onUserSelect?: (user: TUser) => void
}

const AvatarItem: FC<TProps> = ({
  isFirst,
  isLast,
  user,
  size,
  noLazyLoad,
  onUserSelect,
  popCardPlacement,
}) => {
  const selectable = Boolean(user && onUserSelect)
  const s = useSalon({ size, isFirst, isLast, selectable })
  const avatarSrc = user?.avatar || ''
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(avatarSrc) && failedSrc !== avatarSrc
  const label = user?.nickname || user?.name || user?.login || 'avatar'
  const handleSelect = () => {
    if (!user) return

    onUserSelect?.(user)
  }
  const content = (
    <>
      <ImgFallback className={s.avatarFallback} size={size} user={user} />
      {showImage && (
        <Image
          className={s.avatarImage}
          src={avatarSrc}
          alt={label}
          fill
          unoptimized
          loading={noLazyLoad ? 'eager' : 'lazy'}
          draggable={false}
          onError={() => setFailedSrc(avatarSrc)}
        />
      )}
    </>
  )

  return (
    <li className={s.wrapper}>
      <Tooltip
        content={<UserCard user={user} />}
        offset={[5, 25]}
        delay={0}
        placement={popCardPlacement}
        interactive={false}
      >
        {selectable ? (
          <button
            type='button'
            className={s.avatarControl}
            aria-label={label}
            onClick={handleSelect}
          >
            {content}
          </button>
        ) : (
          <span className={s.avatarControl} aria-label={label}>
            {content}
          </span>
        )}
      </Tooltip>
    </li>
  )
}

export default AvatarItem
