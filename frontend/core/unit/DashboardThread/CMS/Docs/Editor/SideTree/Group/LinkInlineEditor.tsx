import { type FC, type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'

import { UNTITLED_TITLE_I18N_KEY } from '../constant'
import { getDefaultLinkTitle, isLinkHref } from '../helper'
import useSalon from '../salon/group/link_inline_editor'
import type { TSideTreeLinkInput } from '../spec'

type TProps = {
  href: string
  title: string
  onCancel: () => void
  onConfirm: (input: TSideTreeLinkInput) => void
}

const LinkInlineEditor: FC<TProps> = ({ href, title, onCancel, onConfirm }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [draftHref, setDraftHref] = useState(href)
  const [draftTitle, setDraftTitle] = useState(title)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const hrefRef = useRef<HTMLInputElement | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [])

  const confirm = (): void => {
    const nextHref = draftHref.trim()

    if (!isLinkHref(nextHref)) {
      setError(t('dsb.cms.docs.side_tree.link.invalid_href'))
      window.setTimeout(() => hrefRef.current?.focus())
      return
    }

    onConfirm({
      href: nextHref,
      title: draftTitle.trim() || getDefaultLinkTitle(nextHref) || t(UNTITLED_TITLE_I18N_KEY),
    })
  }

  const handleBlur = (event: FocusEvent<HTMLFormElement>): void => {
    if (formRef.current?.contains(event.relatedTarget as Node | null)) return
    confirm()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      confirm()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <form ref={formRef} className={s.wrapper} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <input
        ref={titleRef}
        type='text'
        className={s.input}
        value={draftTitle}
        spellCheck={false}
        placeholder={t(UNTITLED_TITLE_I18N_KEY)}
        onChange={(event) => setDraftTitle(event.target.value)}
      />
      <input
        ref={hrefRef}
        type='text'
        className={s.input}
        value={draftHref}
        spellCheck={false}
        placeholder='https://'
        onChange={(event) => {
          setDraftHref(event.target.value)
          setError(null)
        }}
      />
      {error && <div className={s.error}>{error}</div>}
    </form>
  )
}

export default LinkInlineEditor
