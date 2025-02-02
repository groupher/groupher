/*
 *
 * ArrowButtons
 *
 */

import { type FC, memo, type ReactNode } from 'react'

import type { TSpace } from '~/spec'

import PlusSVG from '~/icons/Plus'
import EditSVG from '~/icons/EditPen'

import useSalon from './salon/add_button'

type TProps = {
  children?: ReactNode
  onClick?: () => void
  dimWhenIdle?: boolean
  disabled?: boolean
  withIcon?: boolean
  icon?: 'adder' | 'edit'
} & TSpace

const AddButton: FC<TProps> = ({
  children = '添加',
  onClick = console.log,
  dimWhenIdle = false,
  disabled = false,
  withIcon = true,
  icon = 'adder',
  ...spacing
}) => {
  const s = useSalon({ dimWhenIdle, disabled, ...spacing })

  return (
    <div className={s.wrapper} onClick={() => !disabled && onClick()}>
      {withIcon && icon === 'adder' && <PlusSVG className={s.icon} />}
      {withIcon && icon === 'edit' && <EditSVG className={s.icon} />}
      <div className={s.text}>{children}</div>
    </div>
  )
}

export default memo(AddButton)
