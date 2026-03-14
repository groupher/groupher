'use client'

import { createContext, type ReactNode, useEffect, useMemo, useRef } from 'react'
import { subscribe } from 'valtio'
import useDsbDemoMode from '~/hooks/useDsbDemoMode'
import {
  buildDsbDemoConfig,
  getDsbDemoConfig,
  getDsbDemoSnapshot,
  setDsbDemoConfig,
  setDsbDemoSnapshot,
} from '~/utils/dsb-demo'
import setupStore from '.'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData: TInit
}

export const StoreContext = createContext<TStore | null>(null)
StoreContext.displayName = 'Dashboard'

export default function Provider({ children, initData }: TProps) {
  const storeRef = useRef<TStore | null>(null)
  const isDemoMode = useDsbDemoMode()
  const demoConfig = useMemo(() => {
    if (!isDemoMode) return null

    const baseConfig = buildDsbDemoConfig(initData)
    const storedConfig = getDsbDemoConfig()

    return storedConfig ? { ...baseConfig, ...storedConfig } : baseConfig
  }, [initData, isDemoMode])

  const resolvedInit = useMemo(() => {
    if (!demoConfig) return initData

    return {
      ...initData,
      ...demoConfig,
      initFilled: Boolean(getDsbDemoConfig()),
    }
  }, [demoConfig, initData])

  storeRef.current ??= setupStore(resolvedInit)

  useEffect(() => {
    if (!isDemoMode) return

    const baseConfig = buildDsbDemoConfig(initData)
    if (!getDsbDemoSnapshot()) {
      setDsbDemoSnapshot(baseConfig)
    }

    if (!getDsbDemoConfig()) {
      setDsbDemoConfig(baseConfig)
    }
  }, [initData, isDemoMode])

  useEffect(() => {
    if (!isDemoMode || !storeRef.current) return

    const store = storeRef.current
    const syncConfig = () => setDsbDemoConfig(buildDsbDemoConfig(store))

    syncConfig()
    return subscribe(store, syncConfig)
  }, [isDemoMode])

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
