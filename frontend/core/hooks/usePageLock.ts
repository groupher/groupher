'use client'

import { useCallback, useRef } from 'react'

import { lockPage, unlockPage } from '~/dom'

/**
 * Own one page-scroll lock from a component instance.
 *
 * `lockPage` / `unlockPage` are global and count based. That works for nested
 * overlays, but controlled components can run their effects multiple times
 * during a single open cycle. Calling `lockPage` on each of those renders and
 * `unlockPage` only once leaves the body stuck at `overflow: hidden`.
 *
 * This hook adds a small ownership guard around the global lock: a component
 * can acquire the page lock once, release it once, and safely call either side
 * again during animation fallback, transition end, or unmount cleanup.
 */
export default function usePageLock() {
  const didLockRef = useRef(false)

  const lockPageOnce = useCallback(() => {
    if (didLockRef.current) return
    lockPage()
    didLockRef.current = true
  }, [])

  const unlockPageOnce = useCallback(() => {
    if (!didLockRef.current) return
    unlockPage()
    didLockRef.current = false
  }, [])

  return {
    lockPageOnce,
    unlockPageOnce,
  }
}
