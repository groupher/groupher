import { useCallback, useEffect, useRef } from 'react'

type TPreviewCssVarValue = string | number | null | undefined
type TPreviewCssVars = Record<`--${string}`, TPreviewCssVarValue>

type TOptions = {
  cleanup?: boolean
}

const getPreviewTarget = (): HTMLElement | null => document.querySelector('main')

/**
 * rAF-batched preview CSS variable writer for high-frequency dashboard controls.
 *
 * Use this when an interaction must feel realtime, but updating React state on
 * every event would re-render too much UI. Typical callers are sliders, color
 * pickers, and drag controls. The hook writes CSS variables to <main> in the
 * next animation frame and never stores React state.
 *
 * Note: --preview-page-bg is intentionally consumed by GlobalLayout's
 * background child layer, not <main>'s own background. Keep that separation for
 * paint performance; <main> is a large blurred layout container.
 *
 * Example:
 *   const updatePreviewCssVars = useUpdatePreviewCssVars()
 *
 *   updatePreviewCssVars({
 *     '--preview-page-bg': background,
 *     '--preview-primary-color': primaryColor,
 *   })
 *
 * Values of null/undefined remove that CSS variable. The returned updater is
 * stable, so it can be passed directly to high-frequency handlers. Final,
 * saveable values should still be committed to store/draft outside this hook.
 */
export default function useUpdatePreviewCssVars(options: TOptions = {}) {
  const { cleanup = true } = options
  const frameRef = useRef<number | null>(null)
  const pendingVarsRef = useRef<TPreviewCssVars>({})
  const writtenKeysRef = useRef<Set<`--${string}`>>(new Set())

  const flush = useCallback(() => {
    frameRef.current = null

    const target = getPreviewTarget()
    if (!target) return

    const pendingVars = pendingVarsRef.current
    pendingVarsRef.current = {}

    for (const [key, value] of Object.entries(pendingVars) as [
      `--${string}`,
      TPreviewCssVarValue,
    ][]) {
      writtenKeysRef.current.add(key)

      if (value === null || value === undefined) {
        target.style.removeProperty(key)
        continue
      }

      target.style.setProperty(key, String(value))
    }
  }, [])

  const updatePreviewCssVars = useCallback(
    (vars: TPreviewCssVars) => {
      pendingVarsRef.current = {
        ...pendingVarsRef.current,
        ...vars,
      }

      if (frameRef.current) return

      frameRef.current = window.requestAnimationFrame(flush)
    },
    [flush],
  )

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }

      if (!cleanup) return

      const target = getPreviewTarget()
      if (!target) return

      for (const key of writtenKeysRef.current) {
        target.style.removeProperty(key)
      }
    }
  }, [cleanup])

  return updatePreviewCssVars
}
