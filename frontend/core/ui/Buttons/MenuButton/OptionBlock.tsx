import type { FC } from 'react'

import { ICON } from '~/config'
import { cutRest } from '~/fmt'
import UpvoteIcon from '~/icons/Upvote'
import Img from '~/Img'
import type { TMenuOption } from '~/spec'

import useSalon, { cn } from '../salon/menu_button/menu'

type TProps = {
  item: TMenuOption
  onClick: () => void
}

const resolveIconPath = (icon: string) => (icon.startsWith(ICON) ? icon : `${ICON}/${icon}`)

const OptionBlock: FC<TProps> = ({ item, onClick }) => {
  const s = useSalon()
  const LocalIcon = typeof item.icon === 'function' ? item.icon : UpvoteIcon
  const iconNode =
    typeof item.icon === 'string' ? <Img src={resolveIconPath(item.icon)} /> : <LocalIcon />

  if (item.link) {
    return (
      <a className={cn(s.block, 'no-underline')} href={item.link}>
        <div className={s.item}>
          <div className={s.icon}>{iconNode}</div>
          <div className={s.title}>{cutRest(item.title, 50)}</div>
          <Img src={`${ICON}/shape/link-hint.svg`} className={s.linkIcon} />
        </div>
      </a>
    )
  }
  return (
    <button type='button' className={s.block} onClick={onClick}>
      <div className={s.item}>
        <div className={s.icon}>{iconNode}</div>
        <div className={s.title}>{cutRest(item.title, 50)}</div>
      </div>
    </button>
  )
}

export default OptionBlock
