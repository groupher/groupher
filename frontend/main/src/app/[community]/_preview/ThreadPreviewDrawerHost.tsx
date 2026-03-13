'use client'

import { useParams, useSelectedLayoutSegment } from 'next/navigation'
import { Fragment, type ReactNode, startTransition, useEffect, useRef, useState } from 'react'
import Drawer from '~/widgets/@Drawer'

import { markPreviewPending, usePreviewCacheState } from './preview-cache'
import type { TPreviewCacheEntry } from './spec'

type TProps = {
  children: ReactNode
  resolvePreviewKey: (community?: string, id?: string) => string | null
  renderCachedPreview: (entry: TPreviewCacheEntry, mode: 'lite' | 'full') => ReactNode
}

type TCachedPhase = 'cached-lite' | 'cached-full' | 'real'

const resolveCachedPhase = (
  hasCachedEntry: boolean,
  ready: boolean,
  showCachedFull: boolean,
): TCachedPhase => {
  if (!hasCachedEntry || ready) return 'real'

  return showCachedFull ? 'cached-full' : 'cached-lite'
}

// Cached reopen favors a light first paint, then promotes to the full cached
// preview tree before the real route payload takes over.
const useDeferredCachedFull = (enabled: boolean) => {
  const [showCachedFull, setShowCachedFull] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setShowCachedFull(false)
      return
    }

    setShowCachedFull(false)

    let innerRaf: number | null = null
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        startTransition(() => {
          setShowCachedFull(true)
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(outerRaf)
      if (innerRaf) {
        window.cancelAnimationFrame(innerRaf)
      }
    }
  }, [enabled])

  return showCachedFull
}

export default function ThreadPreviewDrawerHost({
  children,
  resolvePreviewKey,
  renderCachedPreview,
}: TProps) {
  const activeSegment = useSelectedLayoutSegment('previewer')
  const params = useParams<{ community?: string | string[]; id?: string | string[] }>()
  const community = Array.isArray(params.community) ? params.community[0] : params.community
  const resetKey = Array.isArray(params.id) ? params.id[0] : params.id
  const previewKey = resolvePreviewKey(community, resetKey)
  const { entry: cachedEntry, ready } = usePreviewCacheState(previewKey)
  const lastPendingKeyRef = useRef<string | null>(null)
  const showCachedFull = useDeferredCachedFull(Boolean(cachedEntry) && !ready)
  const phase = resolveCachedPhase(Boolean(cachedEntry), ready, showCachedFull)

  useEffect(() => {
    // Each open cycle should flip the matching key back to pending exactly once.
    // The real route will later promote it to ready via PreviewCacheSync.
    if (!previewKey) {
      lastPendingKeyRef.current = null
      return
    }

    if (lastPendingKeyRef.current === previewKey) return

    markPreviewPending(previewKey)
    lastPendingKeyRef.current = previewKey
  }, [previewKey])

  if (!activeSegment) return null

  // The host is the only place where cached preview content is allowed to sit
  // in front of intercepted-route output. That keeps cache behavior out of
  // loading.tsx and preserves a single drawer owner.
  const displayNode =
    cachedEntry && !ready ? (
      renderCachedPreview(cachedEntry, showCachedFull ? 'full' : 'lite')
    ) : (
      <Fragment key={`${previewKey ?? activeSegment}:real`}>{children}</Fragment>
    )

  return <Drawer resetKey={`${resetKey ?? activeSegment}:${phase}`}>{displayNode}</Drawer>
}
