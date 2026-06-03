import { useCallback, useMemo, useState } from 'react'

import type { TDocFaq } from '~/spec'
import { docFaqToDisplayGroups } from '~/stores/dashboard/docFaq/model'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../../constant'
import useHelper from '../../../logic/useHelper'
import type { TFaqEditorGroup, TFaqSaveZone } from './spec'

type TRet = {
  docFaq: TDocFaq
  saveZone: TFaqSaveZone
  isDocFaqTouched: boolean
  displayGroups: readonly TFaqEditorGroup[]
  openedItemId: string | null
  toggleItem: (itemId: string) => void
  openItem: (itemId: string) => void
}

/**
 * View-model hook for the FAQ editor.
 *
 * Persisted FAQ mutations live in `useDocFaqActions`; this hook only derives
 * render data and keeps UI-only expansion state.
 */
export default function useFaqEditor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged } = useHelper()
  const [openedItemId, setOpenedItemId] = useState<string | null>(null)
  const docFaq = dsb$.docFaq
  const saveZone = dsb$.docFaqSaveZone
  const isDocFaqTouched = isChanged(FIELD.DOC_FAQ)
  const displayGroups = useMemo(
    () => docFaqToDisplayGroups(docFaq) as readonly TFaqEditorGroup[],
    [docFaq],
  )

  const toggleItem = useCallback((itemId: string): void => {
    setOpenedItemId((current) => (current === itemId ? null : itemId))
  }, [])

  const openItem = useCallback((itemId: string): void => {
    setOpenedItemId(itemId)
  }, [])

  return {
    docFaq,
    saveZone,
    isDocFaqTouched,
    displayGroups,
    openedItemId,
    toggleItem,
    openItem,
  }
}
