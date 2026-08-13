import { useSnapshot } from 'valtio'

import { useApplyStore } from '../context'

/** Exposes apply step state and actions through the shared React hook boundary. */
export const useApplyStep = () => {
  const store = useApplyStore()
  const snapshot = useSnapshot(store)
  const canContinue =
    snapshot.currentStep === 0 ||
    (snapshot.currentStep === 1 &&
      snapshot.title.trim().length >= 2 &&
      snapshot.slug.length >= 2) ||
    (snapshot.currentStep === 2 && snapshot.desc.trim().length >= 20) ||
    (snapshot.currentStep === 3 && Boolean(snapshot.logoAssetRef))

  return {
    currentStep: snapshot.currentStep,
    canContinue,
    nextStep: () => {
      if (canContinue) store.currentStep = Math.min(3, store.currentStep + 1)
    },
    previousStep: () => {
      store.currentStep = Math.max(0, store.currentStep - 1)
    },
  }
}
