import { useEffect } from 'react'

type TOptions = {
  enabled?: boolean
  cleanupBackground?: string | null
}

// High-frequency theme controls preview against the real <main> background.
// We patch the DOM style directly here so drag interactions stay off the global
// dashboard store and avoid the wider re-render chain during preview.
const applyMainBackground = (background?: string | null) => {
  const main = document.querySelector('main') as HTMLElement | null
  if (!main) return

  if (background) {
    main.style.backgroundColor = background
    return
  }

  main.style.removeProperty('background-color')
}

// Applies a temporary background preview to the main layout area and restores
// the previous/background fallback on cleanup. Callers can disable the effect
// for the inactive theme while still sharing the same hook.
export default function useMainBackgroundPreview(
  background?: string | null,
  options: TOptions = {},
) {
  const { enabled = true, cleanupBackground = null } = options

  useEffect(() => {
    if (!enabled) return

    applyMainBackground(background)

    return () => {
      applyMainBackground(cleanupBackground)
    }
  }, [background, cleanupBackground, enabled])
}
