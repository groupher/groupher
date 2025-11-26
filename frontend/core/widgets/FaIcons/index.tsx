/*
 *
 * FaIcons
 *
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { FC } from 'react'
import '@fortawesome/fontawesome-svg-core/styles.css'

import { camelize } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
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
  testid = 'fa-icons',
  size = 16,
  icon = 'user',
  color = 'ORANGE',
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const colorKey = `rainbow-${camelize(color)}`
  const colorVal = useCSSVar(colorKey)

  return (
    <div className={s.wrapper}>
      <FontAwesomeIcon icon={FaIcon[icon]} fontSize={size} color={colorVal} />
    </div>
  )
}

export default FaIcons
