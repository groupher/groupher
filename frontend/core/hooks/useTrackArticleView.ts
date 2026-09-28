/**
 * Connects rendered Article visibility to the shared ViewTracker mutation.
 *
 *   visible DOM element + ready Article
 *     -> visibility/intersection dwell threshold
 *     -> trackArticleView
 *     -> committed stats/viewer cache patch
 *
 * The hook starts at most one request per Article mount; server-side dedupe remains authoritative
 * for repeated visits and transport retries.
 */
import { VIEW_COUNTING_CONTRACT } from '@groupher/contracts/view-counting'
import { useEffect, useRef, type RefObject } from 'react'

import { articlePathKey } from '~/query/articlePath'
import { trackArticleView } from '~/query/viewTracker'
import type { TArticleLoad } from '~/spec'

/**
 * Tracks once after the Article stays visible for the configured human dwell threshold.
 *
 * Visibility loss cancels the pending timer, unmount disconnects all observers, and failures are
 * intentionally non-blocking because reading the Article must not depend on analytics delivery.
 */
export default function useTrackArticleView(
  wrapperRef: RefObject<HTMLElement | null>,
  article: TArticleLoad,
  ready: boolean,
): void {
  const startedKeyRef = useRef<string | null>(null)
  const articleKey = articlePathKey(article)

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
      if (!visible || !intersecting || timer !== null || startedKeyRef.current === articleKey)
        return
      timer = setTimeout(track, VIEW_COUNTING_CONTRACT.humanMinVisibleMs)
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
