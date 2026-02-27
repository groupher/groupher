import { type FC } from 'react'
import { ICON } from '~/config'
import SVG from '~/const/svg'
import { cutRest } from '~/fmt'
import Img from '~/Img'
import type { TMenuOption } from '~/spec'

import { cn } from '../salon/menu_button/menu'

type TProps = {
  item: TMenuOption
  onClick: () => void
  s: any
}

const OptionBlock: FC<TProps> = ({ item, onClick, s }) => {
  const iconName = item.icon || SVG.UPVOTE

  if (item.link) {
    return (
      <a className={cn(s.block, 'no-underline')} href={item.link}>
        <div className={s.item}>
          <div className={s.icon}>
            {/* @ts-ignore */}
            {s.getIcon(iconName)({})}
          </div>
          <div className={s.title}>{cutRest(item.title, 50)}</div>
          <Img src={`${ICON}/shape/link-hint.svg`} className={s.linkIcon} />
        </div>
      </a>
    )
  }
  return (
    <button className={s.block} onClick={onClick}>
      <div className={s.item}>
        <div className={s.icon}>
          {/* @ts-ignore */}
          {s.getIcon(iconName)({})}
        </div>
        <div className={s.title}>{cutRest(item.title, 50)}</div>
      </div>
    </button>
  )
}

export default OptionBlock
