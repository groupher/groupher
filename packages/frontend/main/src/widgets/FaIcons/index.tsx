/*
 *
 * FaIcons
 *
 */

import type { FC } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import '@fortawesome/fontawesome-svg-core/styles.css'

import type { TSpace, TColorName } from '~/spec'
import useThemeData from '~/hooks/useThemeData'
import { camelize } from '~/fmt'

import FaIcon from './icons'
import type { TIcon } from './spec'

import useSalon from './salon'

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
  const themeData = useThemeData()

  return (
    <div className={s.wrapper}>
      <FontAwesomeIcon
        icon={FaIcon[icon]}
        fontSize={size}
        color={themeData.rainbow[camelize(color)]}
      />
    </div>
  )
}

export default FaIcons
