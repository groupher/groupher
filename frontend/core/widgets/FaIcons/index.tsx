/*
 *
 * FaIcons
 *
 */

import type { CSSProperties, FC } from 'react'

import { COLOR } from '~/const/colors'
import type { TColorName, TSpace } from '~/spec'

import FaIcon from './icons'
import useSalon from './salon'
import type { TIcon } from './spec'

export type TProps = {
  testid?: string
  size?: number
  icon?: TIcon
  color?: TColorName
  opacity?: number
} & TSpace

const FaIcons: FC<TProps> = ({
  testid: _testid = 'fa-icons',
  size = 3.5,
  icon = 'user',
  color = COLOR.ORANGE,
  opacity,
  ...spacing
}) => {
  const s = useSalon({ ...spacing, color, size })
  const iconMeta = FaIcon[icon]
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

export default FaIcons
