import { useSyncExternalStore } from 'react'

// Keep this boundary aligned with the max-width: 1650px layout in styles.css.
const DESKTOP_QUERY = '(min-width: 1651px)'

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(DESKTOP_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches
// CSS hides the desktop group on narrow screens until hydration removes it.
const getServerSnapshot = () => true

/** Tracks the desktop cover breakpoint consistently across hydration and media-query changes. */
export default function useDesktopCoverLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
