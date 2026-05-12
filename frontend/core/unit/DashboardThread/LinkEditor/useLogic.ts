import { useEffect, useState } from 'react'

import type { TLinkDraftItem } from '~/spec'

type TProps = {
  editing: boolean
  editingLink?: TLinkDraftItem
}

export default function useLogic({ editing, editingLink }: TProps) {
  const [snapshot, setSnapshot] = useState<TLinkDraftItem | null>(null)
  const [draft, setDraft] = useState<TLinkDraftItem | null>(null)

  useEffect(() => {
    return () => {
      setSnapshot(null)
      setDraft(null)
    }
  }, [])

  useEffect(() => {
    if (editing && editingLink) {
      setSnapshot(editingLink)
      setDraft(editingLink)
      return
    }

    setSnapshot(null)
    setDraft(null)
  }, [editing, editingLink])

  const isTouched =
    editing &&
    snapshot &&
    draft &&
    (snapshot?.title !== draft.title || snapshot?.link !== draft.link)

  return {
    draft,
    editingDraft: draft ?? editingLink,
    isTouched,
    setDraft,
  }
}
