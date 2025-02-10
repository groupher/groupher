/*
 *
 * MenuItem
 *
 */

import type { FC } from 'react'

import MENU from '~/const/menu'

import type { TMenu } from '~/spec'
import useSalon, { cn, MenuIcon } from './salon'

type TProps = {
  icon: TMenu
  title: string
  onClick?: () => void
}

const MenuItem: FC<TProps> = ({ title, icon, onClick = console.log }) => {
  const s = useSalon()
  const Icon = MenuIcon[icon]

  return (
    <div className={s.wrapper} onClick={onClick}>
      <Icon className={cn(s.icon, s[icon] || '')} />
      {icon === MENU.DELETE ? (
        <div className={s.deleteTitle}>{title}</div>
      ) : (
        <div className={s.title}>{title}</div>
      )}
    </div>
  )
}

export default MenuItem
