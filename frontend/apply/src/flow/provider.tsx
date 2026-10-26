import { type ReactNode, useEffect, useRef } from 'react'
import { subscribe } from 'valtio'

import { ApplyFlowContext } from './context'
import { persistDraft, removeDraft, restoreDraft } from './persistence'
import type { ApplyStore } from './spec'
import { createApplyStore } from './store'

type Props = { accountScope: string; children: ReactNode }

export default function ApplyFlowProvider({ accountScope, children }: Props) {
  const storeRef = useRef<ApplyStore | null>(null)
  storeRef.current ??= createApplyStore()

  useEffect(() => {
    const store = storeRef.current
    if (!store) return
    Object.assign(store, restoreDraft(accountScope) ?? {}, { hydrated: true })
    return subscribe(store, () => {
      const isEmpty =
        store.currentStep === 0 &&
        !store.slug &&
        !store.title &&
        !store.desc &&
        !store.logoAssetRef &&
        !store.applyMessage

      if (store.submittedApplication || isEmpty) removeDraft(accountScope)
      else persistDraft(accountScope, store)
    })
  }, [accountScope])

  return <ApplyFlowContext.Provider value={storeRef.current}>{children}</ApplyFlowContext.Provider>
}
