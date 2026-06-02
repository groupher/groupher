import { type FC, useEffect, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'

import { UNTITLED_TITLE_I18N_KEY } from '../constant'
import useSalon from '../salon/group/inline_title_input'

type TProps = {
  value: string
  onCancel: () => void
  onConfirm: (value: string) => void
}

const InlineTitleInput: FC<TProps> = ({ value, onCancel, onConfirm }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const confirm = (): void => {
    onConfirm(draft.trim() || t(UNTITLED_TITLE_I18N_KEY))
  }

  return (
    <input
      ref={inputRef}
      type='text'
      className={s.input}
      value={draft}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={confirm}
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirm()
        if (e.key === 'Escape') onCancel()
      }}
    />
  )
}

export default InlineTitleInput
