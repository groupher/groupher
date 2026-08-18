import { useSnapshot } from 'valtio'

import { useApplyStore } from '../context'
import { removeDraft } from '../persistence'
import type { ApplyDraft } from '../spec'
import { emptyDraft } from '../store'

/** Exposes apply draft state and actions through the shared React hook boundary. */
export const useApplyDraft = (accountRef: string) => {
  const store = useApplyStore()
  const snapshot = useSnapshot(store)

  return {
    draft: snapshot,
    updateField: <K extends keyof ApplyDraft>(field: K, value: ApplyDraft[K]) => {
      Object.assign(store, { [field]: value })
    },
    clearDraft: () => {
      Object.assign(store, emptyDraft(), { hydrated: true })
      removeDraft(accountRef)
    },
  }
}
