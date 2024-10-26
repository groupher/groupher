import type { FC } from 'react'
import { includes } from 'ramda'

import CheckSVG from '~/icons/CheckBold'

import { LIST, ACTIVE_ITMES } from './constant'
import useSalon, { cn } from '../../styles/dashboard_intros/admins_tab/permision_items'

type TProps = {
  userHover: boolean[]
}

const getActiveItemKeys = (userHover: boolean[]) => {
  const [user1, user2, user3] = userHover
  if (!user1 && !user2 && !user3) return []

  if (user1) return ACTIVE_ITMES.user1
  if (user2) return ACTIVE_ITMES.user2

  return ACTIVE_ITMES.user3
}

const PermissionItems: FC<TProps> = ({ userHover }) => {
  const s = useSalon()

  const activeKeys = getActiveItemKeys(userHover)

  return (
    <div className={s.wrapper}>
      {LIST.map((item) => {
        const { key, title } = item
        const active = includes(key, activeKeys)

        if (key > 10) {
          return (
            <div key={key} className={s.holderItem}>
              <CheckSVG className={cn(s.checkIcon, !active || 'opacity-50')} />
              <div className={cn(s.holderBar, !active || 'opacity-10')} />
            </div>
          )
        }

        return (
          <div key={key} className={cn(s.item, !active || 'opacity-50')}>
            <CheckSVG className={cn(s.checkIcon, !active || 'opacity-50')} />
            <div className={s.title}>{title}</div>
          </div>
        )
      })}
    </div>
  )
}

export default PermissionItems
