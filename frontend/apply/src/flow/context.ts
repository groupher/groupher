import { createContext, useContext } from 'react'

import type { ApplyStore } from './spec'

export const ApplyFlowContext = createContext<ApplyStore | null>(null)

export const useApplyStore = (): ApplyStore => {
  const store = useContext(ApplyFlowContext)
  if (!store) throw new Error('Apply hooks must be used inside ApplyFlowProvider.')
  return store
}
