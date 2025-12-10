// ~/stores/context-tmp.ts
import { createContext } from 'react'
import type { TRootStoreSnapshot } from './spec.tmp' // 确保你定义了 TRootStoreSnapshot

export { default as StoreProvider } from './provider'
export { setupRootStore } from './ssr'

// 核心改变：Context 存储只读快照 (TRootStoreSnapshot)
export const StoreContext = createContext<TRootStoreSnapshot | null>(null)
