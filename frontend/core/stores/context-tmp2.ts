'use client'

// ~/stores/context-tmp.ts
import { createContext, useContext } from 'react'
import type { TRootStoreSnapshot } from './spec.tmp' // 确保你定义了 TRootStoreSnapshot

export { default as StoreProvider } from './provider'
export { setupRootStore } from './ssr'

// 核心改变：Context 存储只读快照 (TRootStoreSnapshot)
export const StoreContext = createContext<TRootStoreSnapshot | null>(null)

// useStore 现在返回只读快照，它天生响应式，不再需要 useSnapshot()
export const useStore = () => {
  const snapshot = useContext(StoreContext)
  if (!snapshot) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return snapshot
}

// 注意：如果你需要一个 Hook 来修改状态（获取可写的 Proxy），你需要另一个 Context 和 Hook，如下所示：
// const StoreProxyInternalContext = createContext<TRootStore | null>(null);
// export const useStoreActions = () => useContext(StoreProxyInternalContext);
