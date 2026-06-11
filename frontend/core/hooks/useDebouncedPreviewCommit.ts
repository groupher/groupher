import { useCallback, useEffect, useRef } from 'react'

type TOptions<T extends object> = {
  delay?: number
  mergePatch?: (current: Partial<T> | null, patch: Partial<T>) => Partial<T>
  onCommit: (patch: Partial<T>) => void
}

/**
 * Debounced commit queue for high-frequency preview fields.
 *
 * Pair this with `useUpdatePreviewCssVars`: the preview path writes directly to
 * DOM/CSS vars in rAF, while this hook merges saveable patches and commits them
 * after the user pauses briefly. It deliberately does not know about any store;
 * callers decide whether the merged patch writes to local draft, dashboard
 * touched fields, or another saveable state.
 *
 * Example:
 *   const { schedule, flush } = useDebouncedPreviewCommit({
 *     onCommit: (patch) => store.commit(patch),
 *   })
 *
 *   previewWithCssVars(patch)
 *   schedule(patch)
 */
export default function useDebouncedPreviewCommit<T extends object>({
  delay = 300,
  mergePatch,
  onCommit,
}: TOptions<T>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatchRef = useRef<Partial<T> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    pendingPatchRef.current = null
  }, [])

  const flush = useCallback(() => {
    const pendingPatch = pendingPatchRef.current
    clear()

    if (pendingPatch) {
      onCommit(pendingPatch)
    }
  }, [clear, onCommit])

  const schedule = useCallback(
    (patch: Partial<T>) => {
      pendingPatchRef.current = mergePatch
        ? mergePatch(pendingPatchRef.current, patch)
        : {
            ...pendingPatchRef.current,
            ...patch,
          }

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(flush, delay)
    },
    [delay, flush, mergePatch],
  )

  useEffect(() => clear, [clear])

  return { schedule, flush, clear }
}
