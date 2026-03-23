/*
 *
 * Input
 *
 */

import { pickBy } from 'ramda'
import { type FC, memo, useCallback } from 'react'

import TextareaAutosize from 'react-textarea-autosize'
import useSalon, { cn } from './salon/textarea'

type TProps = {
  testid?: string
  placeholder?: string
  className?: string
  value?: string | null
  autoFocus: boolean
  disableEnter: boolean
  onChange?: (e) => void
}

const Textarea: FC<TProps> = ({
  onChange = null,
  testid = 'textarea',
  className = '',
  autoFocus,
  disableEnter,
  ...restProps
}) => {
  const s = useSalon()

  const handleOnChange = useCallback((e) => onChange?.(e), [onChange])

  const handleKeydown = useCallback(
    (e) => {
      if (disableEnter && e.keyCode === 13) {
        e.preventDefault()
      }
    },
    [disableEnter],
  )

  const validProps = pickBy((v) => v !== null, restProps)

  return (
    <TextareaAutosize
      className={cn(s.wrapper, className)}
      data-testid={testid}
      onChange={handleOnChange}
      onKeyDown={handleKeydown}
      minRows={1}
      spellCheck='false'
      autoFocus={autoFocus}
      // @ts-expect-error
      {...validProps}
    />
  )
}

export default memo(Textarea)
