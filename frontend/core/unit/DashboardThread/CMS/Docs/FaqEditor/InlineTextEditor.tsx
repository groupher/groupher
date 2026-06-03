import { type ChangeEvent, type KeyboardEvent, useEffect, useRef } from 'react'

import EditSVG from '~/icons/EditPen'

import { FIELD } from '../../../constant'
import SavingBar from '../../../SavingBar'
import { FAQ_EDITOR_COPY } from './constant'
import useSalon, { cn } from './salon/inline_text_editor'

type TProps = {
  value: string
  active: boolean
  editDisabled: boolean
  isTouched: boolean
  grow?: boolean
  multiline?: boolean
  placeholder?: string
  titleClassName?: string
  onChange: (value: string) => void
  onDone: () => void
  onStart: () => void
}

export default function InlineTextEditor({
  value,
  active,
  editDisabled,
  isTouched,
  grow = true,
  multiline = false,
  placeholder = '',
  titleClassName,
  onChange,
  onDone,
  onStart,
}: TProps) {
  const s = useSalon({ grow, multiline })
  const inputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!active) return

    const target = multiline ? textareaRef.current : inputRef.current
    target?.focus()
  }, [active, multiline])

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    onChange(event.target.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') onDone()
  }

  if (active) {
    const input = multiline ? (
      <textarea
        ref={textareaRef}
        rows={2}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        className={s.input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    ) : (
      <input
        ref={inputRef}
        type='text'
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        className={s.input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    )

    return (
      <SavingBar
        field={FIELD.DOC_FAQ}
        isTouched
        minimal
        disabled={!isTouched}
        width={s.savingWidth}
        top={1}
        bottom={1}
        onCancel={onDone}
      >
        <div className={s.editControl}>{input}</div>
      </SavingBar>
    )
  }

  return (
    <div className={s.readonly}>
      <div className={cn(s.text, titleClassName)}>{value || placeholder}</div>
      {!editDisabled && (
        <button
          type='button'
          className={s.editButton}
          aria-label={FAQ_EDITOR_COPY.EDIT_TEXT_ARIA_LABEL}
          onClick={onStart}
        >
          <EditSVG className={s.editIcon} />
        </button>
      )}
    </div>
  )
}
