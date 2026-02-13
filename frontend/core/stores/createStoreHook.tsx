'use client'

import type { Context } from 'react'
import { useContext } from 'react'
import { useSnapshot } from 'valtio'

type TObject = Record<string, unknown>

const createStoreHook = <TStore extends TObject, TSnap extends TObject = TStore>(
  StoreContext: Context<TStore | null>,
  expose?: Array<keyof TStore>,
) => {
  const resolvedExpose = expose ?? (['commit'] as Array<keyof TStore>)
  const storeName = StoreContext.displayName ?? 'Store'
  const errorMessage = `useStore must be used within a ${storeName} store provider`

  return () => {
    const store = useContext(StoreContext)
    if (!store) {
      throw new Error(errorMessage)
    }

    const snap = useSnapshot(store) as TSnap
    const base = snap as TObject
    const extra = resolvedExpose.reduce<TObject>((acc, key) => {
      if (key in store) {
        acc[key as string] = store[key]
      }
      return acc
    }, {})

    return Object.assign({}, base, extra, {
      live$: store,
    }) as TSnap & Partial<TStore> & { live$: TStore }
  }
}

export default createStoreHook
