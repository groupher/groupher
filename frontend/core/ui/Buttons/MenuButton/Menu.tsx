import { isEmpty } from 'ramda'
import { type FC, Fragment, lazy, memo, Suspense } from 'react'

import type { TMenuOption } from '~/spec'

import useSalon, { cn } from '../salon/menu_button/menu'
import OptionBlock from './OptionBlock'

const QRCode = lazy(() => import('./QRCode'))

type TProps = {
  options: TMenuOption[]
  extraOptions: TMenuOption[]
  panelMinWidth: string
  active: boolean
  onClick?: (key?: string) => void
}

const Menu: FC<TProps> = ({ options, extraOptions, onClick, panelMinWidth, active }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, panelMinWidth)}>
      {options.map((item) => (
        <Fragment key={item.key}>
          <OptionBlock item={item} onClick={() => onClick(item.key)} />
          {active && item.qrLink && (
            <div className={s.qrWrapper}>
              <Suspense fallback={null}>
                <QRCode value={item.qrLink} />
              </Suspense>
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
