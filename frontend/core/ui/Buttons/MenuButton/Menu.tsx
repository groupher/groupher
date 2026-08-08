import { QRCodeSVG } from 'qrcode.react'
import { isEmpty } from 'ramda'
import { type FC, Fragment, memo } from 'react'

import type { TMenuOption } from '~/spec'

import useSalon, { cn } from '../salon/menu_button/menu'
import OptionBlock from './OptionBlock'

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
          <OptionBlock item={item} onClick={() => onClick(item.key)} s={s} />
          {item.qrLink && (
            <div className={s.qrWrapper}>
              <QRCodeSVG value={item.qrLink} size={72} />
            </div>
          )}
        </Fragment>
      ))}
      {!isEmpty(extraOptions) && <div className={s.divider} />}
      {extraOptions.map((item) => (
        <OptionBlock key={item.key} item={item} onClick={() => onClick(item.key)} s={s} />
      ))}
    </div>
  )
}

export default memo(Menu)
