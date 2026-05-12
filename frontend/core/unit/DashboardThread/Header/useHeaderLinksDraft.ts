import { clone, equals } from 'ramda'
import { useEffect, useMemo, useState } from 'react'

import { normalizeHeaderLinks } from '~/hooks/useHeaderLinks/helper'
import type { TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from '../logic/useHelper'

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

type TRet = {
  draftLinks: readonly TLinkItem[]
  setDraftLinks: React.Dispatch<React.SetStateAction<readonly TLinkItem[]>>
  isTouched: boolean
  resetDraft: () => void
  saveDraft: () => void
  makeId: (prefix: string) => string
}

export default function useHeaderLinksDraft(): TRet {
  const dsb$ = useDashboard()
  const { slug } = useCommunity()
  const { onSave } = useHelper()
  const source = useMemo(
    () => normalizeHeaderLinks(dsb$.headerLinks, slug),
    [dsb$.headerLinks, slug],
  )
  const original = useMemo(
    () => normalizeHeaderLinks(dsb$.original.headerLinks, slug),
    [dsb$.original.headerLinks, slug],
  )
  const [draftLinks, setDraftLinks] = useState<readonly TLinkItem[]>(source)

  useEffect(() => {
    setDraftLinks(source)
  }, [source])

  const isTouched = useMemo(() => !equals(draftLinks, original), [draftLinks, original])

  const resetDraft = (): void => {
    setDraftLinks(clone(original))
  }

  const saveDraft = (): void => {
    dsb$.editField(FIELD.HEADER_LINKS, clone(normalizeHeaderLinks(draftLinks, slug)))
    onSave(FIELD.HEADER_LINKS)
  }

  return {
    draftLinks,
    setDraftLinks,
    isTouched,
    resetDraft,
    saveDraft,
    makeId,
  }
}
