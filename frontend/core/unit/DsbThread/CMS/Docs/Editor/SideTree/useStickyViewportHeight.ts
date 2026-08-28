import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from 'react'

type TViewportHeightInput = {
  elementTop: number
  stickyTop: number
  viewportHeight: number
}

/** Returns sticky viewport height for the frontend shared workflow. */
export const getStickyViewportHeight = ({
  elementTop,
  stickyTop,
  viewportHeight,
}: TViewportHeightInput): number => Math.max(0, viewportHeight - Math.max(stickyTop, elementTop))

/** Exposes sticky viewport height state and actions through the shared React hook boundary. */
export default function useStickyViewportHeight(
  stickyTop: number,
  layoutKey: string,
): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null)
  const frameRef = useRef<number | null>(null)

  const updateHeight = useCallback(() => {
    frameRef.current = null

    const node = ref.current
    if (!node) return

    const height = getStickyViewportHeight({
      elementTop: node.getBoundingClientRect().top,
      stickyTop,
      viewportHeight: window.innerHeight,
    })
    const nextHeight = `${height}px`

    if (node.style.height !== nextHeight) node.style.height = nextHeight
  }, [stickyTop])

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(updateHeight)
  }, [updateHeight])

  // Measure before paint only when an external layout state moves the tree's
  // natural top edge. Internal tree renders do not change this anchor.
  useLayoutEffect(() => {
    updateHeight()
  }, [layoutKey, updateHeight])

  useEffect(() => {
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [scheduleUpdate])

  return ref
}
