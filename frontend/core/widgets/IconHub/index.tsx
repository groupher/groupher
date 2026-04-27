/*
 *
 * IconHub
 *
 */

import type { CSSProperties, FC } from 'react'

import { COLOR } from '~/const/colors'
import type { TColorName, TSpace } from '~/spec'

import ICONS from './icons'
import useSalon from './salon'
import type { TIcon, TProvider } from './spec'

export type TProps = {
  testid?: string
  size?: number
  icon?: TIcon
  provider?: TProvider
  color?: TColorName
  opacity?: number
} & TSpace

const IconHub: FC<TProps> = ({
  testid: _testid = 'icon-hub',
  size = 3.5,
  icon = 'user',
  provider = 'fa',
  color = COLOR.ORANGE,
  opacity,
  ...spacing
}) => {
  const s = useSalon({ ...spacing, color, size })
  const providerIcons = ICONS[provider] as Record<string, string>
  const iconMeta = providerIcons[icon]
  const style = {
    WebkitMaskImage: `url(${iconMeta})`,
    maskImage: `url(${iconMeta})`,
    opacity,
  } as CSSProperties

  return (
    <div className={s.wrapper} data-testid={_testid}>
      <span aria-hidden='true' className={s.icon} style={style} />
    </div>
  )
}

export default IconHub
