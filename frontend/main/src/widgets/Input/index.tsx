/*
 *
 * Input
 *
 */

import { type FC, useCallback } from 'react'
import { pickBy } from 'ramda'

import Img from '~/Img'
import { nilOrEmpty } from '~/validator'

import Textarea from './Textarea'
import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
  behavior?: 'default' | 'textarea'
  placeholder?: string
  value?: string | null
  prefixIcon?: string | null
  prefixActive?: boolean
  suffixIcon?: string | null
  suffixActive?: boolean
  disabled?: boolean
  autoFocus?: boolean
  disableEnter?: boolean
  className?: string

  onFocus?: (e) => void
  onBlur?: (e) => void
  onChange?: (e) => void
  onEnter?: () => void
}

const Input: FC<TProps> = ({
  behavior = 'default',
  onChange = null,
  onEnter = null,
  onFocus = null,
  onBlur = null,
  prefixIcon = null,
  prefixActive = false,
  suffixIcon = null,
  suffixActive = false,
  testid = 'input',
  autoFocus = false,
  disableEnter = false,
  className = '',
  ...restProps
}) => {
  const s = useSalon()

  const handleOnChange = useCallback((e) => onChange?.(e), [onChange])
  const handleOnKeydown = useCallback(
    (e) => {
      if (e.key === 'Enter' && onEnter) {
        onEnter()
      }
    },
    [onEnter],
  )

  const handleOnFocus = useCallback((e) => onFocus?.(e), [onFocus])
  const handleOnBlur = useCallback((e) => onBlur?.(e), [onBlur])
  const validProps = pickBy((v) => v !== null, restProps)

  return behavior === 'default' ? (
    <div className={s.wrapper} data-testid={testid}>
      <div className={cn(s.prefix, nilOrEmpty(prefixIcon) && 'hidden')}>
        {prefixIcon && (
          <Img className={cn(s.icon, prefixActive && s.iconActive)} src={prefixIcon} />
        )}
      </div>
      <input
        className={cn(
          s.input,
          !nilOrEmpty(prefixIcon) && 'pl-7',
          !nilOrEmpty(suffixIcon) && 'pr-7',
          className,
        )}
        onChange={handleOnChange}
        onKeyDown={handleOnKeydown}
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        spellCheck="false"
        // biome-ignore lint/a11y/noAutofocus: <explanation>
        autoFocus={autoFocus}
        // @ts-ignore
        {...validProps}
      />
      <div className={cn(s.suffix, nilOrEmpty(suffixIcon) && 'hidden')}>
        {suffixIcon && (
          <Img className={cn(s.icon, suffixActive && s.iconActive)} src={suffixIcon} />
        )}
      </div>
    </div>
  ) : (
    <Textarea
      testid={testid}
      className={className}
      onChange={onChange}
      autoFocus={autoFocus}
      disableEnter={disableEnter}
      {...restProps}
    />
  )
}

export default Input
