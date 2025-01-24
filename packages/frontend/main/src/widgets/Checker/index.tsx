/*
 *
 * Checker
 *
 */

import type { FC, ReactNode } from 'react'

import type { TColorName, TSizeSM, TSpace } from '~/spec'
import SIZE from '~/const/size'

import CheckedSVG from '~/icons/CheckBold'

import useSalon from './salon'

type TProps = {
  children?: ReactNode | null
  checked?: boolean
  hiddenMode?: boolean
  size?: TSizeSM
  dimWhenIdle?: boolean
  disabled?: boolean
  color?: TColorName | null
  onChange?: (checked: boolean) => void
} & TSpace

const Checker: FC<TProps> = ({
  checked = false,
  onChange = console.log,
  hiddenMode = false,
  size = SIZE.MEDIUM,
  children = null,
  disabled = false,
  dimWhenIdle = false,
  color = null,
  ...spacing
}) => {
  const s = useSalon({ disabled, checked, hiddenMode, dimWhenIdle, color, size, ...spacing })

  const show = checked || !hiddenMode

  return (
    <div className={s.wrapper} onClick={() => show && !disabled && onChange(!checked)}>
      <div className={s.iconBox}>
        <CheckedSVG className={s.checkIcon} />
      </div>
      <div className={s.children}>{children}</div>
    </div>
  )
}

export default Checker
