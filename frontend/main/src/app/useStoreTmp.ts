// ~/hooks/useStoreTmp.ts
'use client'

import { useContext } from 'react'
// 移除了 useSnapshot 导入
import { StoreContext } from '~/stores/context-tmp' // 从你的 context-tmp 导入
import type { TRootStoreSnapshot } from '~/stores/spec.tmp' // 从你的 spec 文件导入

/**
 * 响应式且安全的 useStore Hook。
 */
export const useStoreTmp = (): TRootStoreSnapshot => {
  // 直接获取快照，避免 proxyState is not iterable 错误
  const snapshot = useContext(StoreContext)

  if (!snapshot) {
    throw new Error('useStoreTmp must be used within a StoreProvider2 (or equivalent).')
  }

  return snapshot
}

// 示例：获取子 store 的 Hook (保持不变)
export const useSubStoreTmp = <K extends keyof TRootStoreSnapshot>(
  tree: K,
): TRootStoreSnapshot[K] => {
  const snap = useStoreTmp()
  return snap[tree]
}
