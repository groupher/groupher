/*
 *
 * Input
 *
 */

import { pickBy } from 'ramda'
import { type FC, memo, useCallback } from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import { cnMerge } from '~/css'
import useAutoFocus from '~/hooks/useAutoFocus'

import type { TFgColor } from '.'
import useSalon from './salon/textarea'

type TProps = {
  testid?: string
  placeholder?: string
  className?: string
  fgColor?: TFgColor
  value?: string | null
  focusOnMount: boolean
  disableEnter: boolean
  onChange?: (e) => void
}

const Textarea: FC<TProps> = ({
  onChange = null,
  testid = 'textarea',
  className = '',
  fgColor = 'default',
  focusOnMount,
  disableEnter,
  ...restProps
}) => {
  const s = useSalon({ fgColor })
  const textareaRef = useAutoFocus<HTMLTextAreaElement>(focusOnMount)

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
      className={cnMerge(s.wrapper, className)}
      data-testid={testid}
      onChange={handleOnChange}
      onKeyDown={handleKeydown}
      minRows={1}
      ref={textareaRef}
      spellCheck='false'
      // @ts-expect-error
      {...validProps}
    />
  )
}

export default memo(Textarea)
