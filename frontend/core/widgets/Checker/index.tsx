/*
 *
 * Checker (semantic)
 *
 */

'use client'

import { type FC, type ReactNode, useEffect, useRef } from 'react'
import SIZE from '~/const/size'
import CheckedSVG from '~/icons/CheckBold'
import type { TColorName, TSizeSM, TSpace } from '~/spec'

import useSalon from './salon'

type TProps = {
  children?: ReactNode | null
  checked?: boolean
  indeterminate?: boolean
  hiddenMode?: boolean
  size?: TSizeSM
  dimWhenIdle?: boolean
  disabled?: boolean
  color?: TColorName | null
  onChange?: (checked: boolean) => void

  /** pass-through a11y */
  'aria-label'?: string
} & TSpace

const Checker: FC<TProps> = ({
  checked = false,
  indeterminate = false,
  onChange,
  hiddenMode = false,
  size = SIZE.MEDIUM,
  children = null,
  disabled = false,
  dimWhenIdle = false,
  color = null,
  'aria-label': ariaLabel,
  ...spacing
}) => {
  const show = checked || indeterminate || !hiddenMode
  const s = useSalon({
    disabled,
    checked,
    indeterminate,
    hiddenMode,
    dimWhenIdle,
    color,
    size,
    ...spacing,
  })

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.indeterminate = !!indeterminate && !checked
  }, [indeterminate, checked])

  if (!show) return null

  return (
    <label className={s.wrapper}>
      <input
        ref={inputRef}
        type='checkbox'
        className={s.input}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
      />

      <span className={s.iconBox} aria-hidden='true'>
        <CheckedSVG className={s.checkIcon} />
        <span className={s.mixedIcon} />
      </span>

      {children ? <span className={s.children}>{children}</span> : null}
    </label>
  )
}

export default Checker
