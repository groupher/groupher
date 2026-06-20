/*
 *
 * Input
 *
 */

import { pickBy } from 'ramda'
import { type FC, useCallback } from 'react'

import useAutoFocus from '~/hooks/useAutoFocus'
import Img from '~/Img'
import { nilOrEmpty } from '~/validator'

import useSalon, { cn } from './salon'
import Textarea from './Textarea'
import { cnMerge } from '~/css'

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
  focusOnMount?: boolean
  disableEnter?: boolean
  className?: string
  width?: string
  id?: string | null

  onFocus?: (e) => void
  onBlur?: (e) => void
  onChange?: (e) => void
  onEnter?: () => void
}

const Input: FC<TProps> = ({
  behavior = 'default',
  id = null,
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
  focusOnMount = false,
  disableEnter = false,
  className = '',
  width = 'w-full',
  ...restProps
}) => {
  const s = useSalon({ width })

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
  const shouldFocusOnMount = autoFocus || focusOnMount
  const inputRef = useAutoFocus<HTMLInputElement>(shouldFocusOnMount)

  return behavior === 'default' ? (
    <div className={s.wrapper} data-testid={testid}>
      <div className={cn(s.prefix, nilOrEmpty(prefixIcon) && 'hidden')}>
        {prefixIcon && (
          <Img className={cn(s.icon, prefixActive && s.iconActive)} src={prefixIcon} />
        )}
      </div>
      <input
        className={cnMerge(
          s.input,
          !nilOrEmpty(prefixIcon) && 'pl-7',
          !nilOrEmpty(suffixIcon) && 'pr-7',
          className,
        )}
        id={id ?? undefined}
        onChange={handleOnChange}
        onKeyDown={handleOnKeydown}
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        spellCheck='false'
        ref={inputRef}
        // @ts-expect-error
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
      focusOnMount={shouldFocusOnMount}
      disableEnter={disableEnter}
      {...restProps}
    />
  )
}

export default Input
