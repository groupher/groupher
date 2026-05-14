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
    const base = snap as TObject
    const extra = resolvedExpose.reduce<TObject>((acc, key) => {
      if (key in store) {
        const value = store[key]

        acc[key as string] =
          typeof value === 'function'
            ? // Re-resolve actions from the live store so HMR does not leave
              // components holding stale proxy method references.
              (exposedFnsRef.current[key as string] ??= (...args: unknown[]) => {
                const current = storeRef.current[key]
                if (typeof current !== 'function') return undefined

                return (current as TFunc)(...args)
              })
            : value
      }
      return acc
    }, {})

    return Object.assign({}, base, extra, {
      live$: store,
    }) as TSnap & Partial<TStore> & { live$: TStore }
  }
}

export default createStoreHook
