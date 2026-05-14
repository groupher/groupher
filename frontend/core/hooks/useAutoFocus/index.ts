import { type RefObject, useEffect, useRef } from 'react'

type TFocusable = HTMLElement & {
  focus: (options?: FocusOptions) => void
}

type TOptions = {
  preventScroll?: boolean
}

export const useAutoFocusTarget = <T extends TFocusable>(
  ref: RefObject<T | null>,
  enabled = false,
  { preventScroll = true }: TOptions = {},
): void => {
  useEffect(() => {
    if (!enabled) return

    const node = ref.current
    if (!node || node === document.activeElement) return

    // Keep focus changes behind explicit component state instead of JSX `autoFocus`.
    // This preserves edit/create dialog ergonomics without unconditional browser focus
    // stealing on render, and keeps jsx-a11y/no-autofocus enforceable.
    node.focus({ preventScroll })
  }, [enabled, preventScroll, ref])
}

const useAutoFocus = <T extends TFocusable>(
  enabled = false,
  options?: TOptions,
): RefObject<T | null> => {
  const ref = useRef<T | null>(null)

  useAutoFocusTarget(ref, enabled, options)

  return ref
}

export default useAutoFocus
