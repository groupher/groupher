'use client'

import { useParams, useSelectedLayoutSegment } from 'next/navigation'
import {
  Fragment,
  type ReactNode,
  Suspense,
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import Drawer from '~/widgets/@Drawer'
import type { TPreviewPhase } from './constant'
import { PREVIEW_PHASE } from './constant'
import {
  clearPreviewIntentKey,
  markPreviewPending,
  setPreviewIntentKey,
  usePreviewCacheState,
  usePreviewIntentKey,
} from './hooks'
import type { TPreviewCacheEntryBase } from './spec'

type TProps<TEntry extends TPreviewCacheEntryBase> = {
  children: ReactNode
  resolvePreviewKey: (community?: string, id?: string) => string | null
  renderPreview: (entry: TEntry, phase: TPreviewPhase) => ReactNode
  loadingFallback: ReactNode
}

const resolveParamValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)

const resolvePreviewPhase = (
  hasCachedEntry: boolean,
  ready: boolean,
  showCachedFull: boolean,
): TPreviewPhase => {
  if (!hasCachedEntry || ready) return PREVIEW_PHASE.LIVE

  return showCachedFull ? PREVIEW_PHASE.CACHED_FULL : PREVIEW_PHASE.CACHED_LITE
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

const usePreviewRouteState = <TEntry extends TPreviewCacheEntryBase>(
  resolvePreviewKey: (community?: string, id?: string) => string | null,
) => {
  const activeSegment = useSelectedLayoutSegment('previewer')
  const params = useParams<{ community?: string | string[]; id?: string | string[] }>()
  const community = resolveParamValue(params.community)
  const id = resolveParamValue(params.id)
  const routePreviewKey = activeSegment && community && id ? resolvePreviewKey(community, id) : null
  const intentKey = usePreviewIntentKey()
  const previewKey = routePreviewKey ?? intentKey
  const cacheState = usePreviewCacheState<TEntry>(previewKey)

  return {
    activeSegment,
    community,
    id,
    intentKey,
    previewKey,
    routePreviewKey,
    ...cacheState,
  }
}

const useMarkPreviewPending = (previewKey: string | null) => {
  const lastPendingKeyRef = useRef<string | null>(null)

  useLayoutEffect(() => {
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
}

const renderDisplayNode = <TEntry extends TPreviewCacheEntryBase>(
  cachedEntry: TEntry | null,
  ready: boolean,
  previewKey: string | null,
  activeSegment: string | null,
  children: ReactNode,
  renderPreview: (entry: TEntry, phase: TPreviewPhase) => ReactNode,
  phase: TPreviewPhase,
  loadingFallback: ReactNode,
) => {
  if (cachedEntry && !ready) {
    return renderPreview(cachedEntry, phase)
  }

  if (previewKey && !activeSegment) {
    return loadingFallback
  }

  return (
    <Suspense fallback={loadingFallback}>
      <Fragment key={`${previewKey ?? activeSegment}:${PREVIEW_PHASE.LIVE}`}>{children}</Fragment>
    </Suspense>
  )
}

export default function PreviewHost<TEntry extends TPreviewCacheEntryBase>({
  children,
  resolvePreviewKey,
  renderPreview,
  loadingFallback,
}: TProps<TEntry>) {
  const {
    activeSegment,
    community,
    id,
    intentKey,
    previewKey,
    routePreviewKey,
    entry: cachedEntry,
    ready,
  } = usePreviewRouteState<TEntry>(resolvePreviewKey)
  const showCachedFull = useDeferredCachedFull(Boolean(cachedEntry) && !ready)
  const phase = resolvePreviewPhase(Boolean(cachedEntry), ready, showCachedFull)

  useMarkPreviewPending(previewKey)

  useEffect(() => {
    if (!community) return

    const handlePreviewIntent = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const previewTarget = target.closest<HTMLElement>('[data-preview-id]')
      if (!previewTarget) return

      const previewId = previewTarget.dataset.previewId
      if (!previewId) return

      const nextPreviewKey = resolvePreviewKey(community, previewId)
      if (!nextPreviewKey) return

      setPreviewIntentKey(nextPreviewKey)
    }

    document.addEventListener('click', handlePreviewIntent, true)
    return () => document.removeEventListener('click', handlePreviewIntent, true)
  }, [community, resolvePreviewKey])

  useEffect(() => {
    if (!routePreviewKey || intentKey !== routePreviewKey) return
    clearPreviewIntentKey(routePreviewKey)
  }, [intentKey, routePreviewKey])

  if (!activeSegment && !previewKey) return null

  const displayNode = renderDisplayNode(
    cachedEntry,
    ready,
    previewKey,
    activeSegment,
    children,
    renderPreview,
    phase,
    loadingFallback,
  )

  return <Drawer resetKey={`${id ?? activeSegment}:${phase}`}>{displayNode}</Drawer>
}
