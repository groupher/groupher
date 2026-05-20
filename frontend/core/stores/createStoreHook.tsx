'use client'

import type { Context } from 'react'
import { use, useRef } from 'react'
import { useSnapshot } from 'valtio'

type TObject = Record<string, unknown>
type TFunc = (...args: unknown[]) => unknown

const createStoreHook = <TStore extends TObject, TSnap extends TObject = TStore>(
  StoreContext: Context<TStore | null>,
  expose?: Array<keyof TStore>,
) => {
  const resolvedExpose = expose ?? (['commit'] as Array<keyof TStore>)
  const storeName = StoreContext.displayName ?? 'Store'
  const errorMessage = `useStore must be used within a ${storeName} store provider`

  return () => {
    const store = use(StoreContext)
    if (!store) {
      throw new Error(errorMessage)
    }

    const storeRef = useRef(store)
    storeRef.current = store
    const exposedFnsRef = useRef<Record<string, TFunc>>({})

    const snap = useSnapshot(store) as TSnap
    const result = {} as TObject
    const exposedKeys = new Set<keyof TStore>(resolvedExpose)

    // Do not spread/copy the snapshot here. Valtio tracks which snapshot fields
    // are read during render, and eager copying would subscribe every consumer
    // to every top-level store key. Lazy getters keep the existing `useStore()`
    // object API while preserving Valtio's field-level render optimization.
    for (const key of Object.keys(store) as Array<keyof TStore>) {
      if (exposedKeys.has(key) && typeof store[key] === 'function') {
        Object.defineProperty(result, key, {
          enumerable: true,
          value: (exposedFnsRef.current[key as string] ??= (...args: unknown[]) => {
            const current = storeRef.current[key]
            if (typeof current !== 'function') return undefined

            return (current as TFunc)(...args)
          }),
        })
        continue
      }

      Object.defineProperty(result, key, {
        enumerable: true,
        get: () => (snap as TObject)[key as string],
      })
    }

    for (const key of resolvedExpose) {
      if (key in store) {
        const value = store[key]

        if (typeof value === 'function' || key in result) continue

        Object.defineProperty(result, key, {
          enumerable: true,
          get: () => storeRef.current[key],
        })
      }
    }

    Object.defineProperty(result, 'live$', {
      enumerable: true,
      value: store,
    })

    return result as TSnap & Partial<TStore> & { live$: TStore }
  }
}

export default createStoreHook
