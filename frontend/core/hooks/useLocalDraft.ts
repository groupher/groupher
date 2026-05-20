import { equals } from 'ramda'
import { useCallback, useEffect, useMemo, useState } from 'react'

import useDashboard from '~/stores/dashboard/hooks'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

type TFieldKey = keyof TDsbFieldMap

type TRet<T> = {
  draft: T
  setDraft: React.Dispatch<React.SetStateAction<T>>
  isTouched: boolean
  resetDraft: () => void
}

/**
 * Keeps a local draft for high-frequency dashboard interactions.
 *
 * The draft initializes from the current store field, stays local while the UI
 * is being dragged/edited, and resets when the external store-backed source
 * changes (for example after save, cancel, or theme switching).
 */
export default function useLocalDraft<K extends TFieldKey>(field: K): TRet<TDsbFieldMap[K]>
export default function useLocalDraft<T>(source: T, original: T): TRet<T>
export default function useLocalDraft<K extends TFieldKey, T>(
  fieldOrSource: K | T,
  maybeOriginal?: T,
): TRet<TDsbFieldMap[K] | T> {
  const dsb$ = useDashboard()
  const isFieldMode = typeof fieldOrSource === 'string' && maybeOriginal === undefined
  const source = isFieldMode ? dsb$[fieldOrSource as K] : (fieldOrSource as T)
  const original = isFieldMode ? dsb$.original[fieldOrSource as K] : (maybeOriginal as T)

  const [draft, setDraft] = useState<TDsbFieldMap[K] | T>(source)

  useEffect(() => {
    setDraft(source as TDsbFieldMap[K] | T)
  }, [source])

  const isTouched = useMemo(() => !equals(draft, original), [draft, original])
  const resetDraft = useCallback(() => setDraft(original), [original])

  return {
    draft,
    setDraft,
    isTouched,
    resetDraft,
  }
}
