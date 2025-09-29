import { QRCodeSVG } from 'qrcode.react'
import { isEmpty } from 'ramda'
import { type FC, Fragment, memo } from 'react'
import { ICON } from '~/config'
import SVG from '~/const/svg'
import { cutRest } from '~/fmt'
import Img from '~/Img'
import type { TMenuOption } from '~/spec'

import useSalon, { cn } from '../salon/menu_button/menu'

// there is two types of block, normal block and link
const OptionBlock = ({ item, onClick }) => {
  const s = useSalon()
  const Icon = s.getIcon(item.icon || SVG.UPVOTE)

  if (item.link) {
    return (
      <a className={cn(s.block, 'no-underline')} href={item.link}>
        <div className={s.item}>
          {/* @ts-ignore */}
          <Icon className={s.icon} />
          <div className={s.title}>{cutRest(item.title, 50)}</div>
          <Img src={`${ICON}/shape/link-hint.svg`} className={s.linkIcon} />
        </div>
      </a>
    )
  }
  return (
    <button className={s.block} onClick={onClick}>
      <div className={s.item}>
        {/* @ts-ignore */}
        <Icon className={s.icon} />
        <div className={s.title}>{cutRest(item.title, 50)}</div>
      </div>
    </button>
  )
}

type TProps = {
  options: TMenuOption[]
  extraOptions: TMenuOption[]
  panelMinWidth: string
  onClick?: (key?: string) => void
}

const Menu: FC<TProps> = ({ options, extraOptions, onClick, panelMinWidth }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, panelMinWidth)}>
      {options.map((item) => (
        <Fragment key={item.key}>
          <OptionBlock item={item} onClick={() => onClick(item.key)} />
          {item.qrLink && (
            <div className={s.qrWrapper}>
              <QRCodeSVG value={item.qrLink} size={72} />
            </div>
          )}
        </Fragment>
      ))}
      {!isEmpty(extraOptions) && <div className={s.divider} />}
      {extraOptions.map((item) => (
        <OptionBlock key={item.key} item={item} onClick={() => onClick(item.key)} />
      ))}
    </div>
  )
}

export default memo(Menu)
