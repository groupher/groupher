// ~/stores/tmpStore.ts
'use client'

import { createContext, useContext, useRef } from 'react'
import { create, useStore } from 'zustand'
import type { TRootStoreInit } from './spec.tmp'

// === store 状态类型 + actions ===
type StoreState = TRootStoreInit & {
  setArticles: (articles: TRootStoreInit['articles']) => void
}

// === 定义初始默认状态 ===
const defaultInitialState: TRootStoreInit = {
  articles: {},
}

// === 核心：创建 Zustand store 的函数 ===
// 接收一个可选的初始状态
export const createTmpStore = (initState: TRootStoreInit = defaultInitialState) => {
  return create<StoreState>((set) => ({
    ...initState,
    // action
    setArticles: (articles) => set({ articles }),
  }))
}

// === 设置 Context Provider 基础设施 ===
// 这里的 StoreApi 类型是为了 TypeScript 的类型安全
type TmpStoreApi = ReturnType<typeof createTmpStore>

export const TmpStoreContext = createContext<TmpStoreApi | undefined>(undefined)

// 自定义的 Provider 组件
export function ZustandStoreProvider({
  children,
  initData,
}: {
  children: React.ReactNode
  initData?: TRootStoreInit
}) {
  // useRef 确保 store 实例在整个组件生命周期内只创建一次
  const storeRef = useRef<TmpStoreApi>(null)
  if (!storeRef.current) {
    storeRef.current = createTmpStore(initData)
  }

  return <TmpStoreContext.Provider value={storeRef.current}>{children}</TmpStoreContext.Provider>
}

// 自定义 Hook 以便在组件中使用 store
export function useArticleStore<T>(selector: (store: StoreState) => T): T {
  const storeContext = useContext(TmpStoreContext)

  if (!storeContext) {
    throw new Error(`useArticleStore must be used within ZustandStoreProvider`)
  }

  // 使用 Zustand 的 useStore hook 来订阅 Context 中的 store 实例
  return useStore(storeContext, selector)
}
