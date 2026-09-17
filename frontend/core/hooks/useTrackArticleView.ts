import { useEffect, useRef, type RefObject } from 'react'

import { trackArticleView } from '~/query/viewTracker'
import type { TArticleLoad } from '~/spec'

const MIN_VISIBLE_MS = 1_000

/** Tracks once after a rendered Article is visible in the foreground for one second. */
export default function useTrackArticleView(
  wrapperRef: RefObject<HTMLElement | null>,
  article: TArticleLoad,
  ready: boolean,
): void {
  const startedKeyRef = useRef<string | null>(null)
  const articleKey = `${article.community}:${article.thread}:${article.innerId}`

  useEffect(() => {
    const element = wrapperRef.current
    if (!ready || !element || startedKeyRef.current === articleKey) return

    let intersecting = false
    let visible = typeof document === 'undefined' || document.visibilityState === 'visible'
    let timer: ReturnType<typeof setTimeout> | null = null

    const clearTimer = () => {
      if (timer === null) return
      clearTimeout(timer)
      timer = null
    }

    const track = () => {
      timer = null
      if (startedKeyRef.current === articleKey) return
      if (!visible || !intersecting) return
      startedKeyRef.current = articleKey
      void trackArticleView(article).catch(() => undefined)
    }

    const maybeTrack = () => {
      if (!visible || !intersecting || timer !== null || startedKeyRef.current === articleKey) return
      timer = setTimeout(track, MIN_VISIBLE_MS)
    }

    const handleVisibilityChange = () => {
      visible = document.visibilityState === 'visible'
      if (visible) maybeTrack()
      else clearTimer()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (typeof IntersectionObserver === 'undefined') {
      intersecting = true
      maybeTrack()
      return () => {
        clearTimer()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some((entry) => entry.isIntersecting)
        if (intersecting) maybeTrack()
        else clearTimer()
      },
      { threshold: 0.01 },
    )
    observer.observe(element)

    return () => {
      clearTimer()
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [article.community, article.innerId, article.thread, articleKey, ready, wrapperRef])
}
