'use client'

import { useMemo, useSyncExternalStore } from 'react'

import type { TPreviewCacheEntry } from './spec'

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000

const previewCache = new Map<string, TPreviewCacheEntry>()
const previewStatus = new Map<string, 'pending' | 'ready'>()
const listeners = new Set<() => void>()
let previewCacheVersion = 0

const emit = () => {
  previewCacheVersion += 1
  for (const listener of listeners) {
    listener()
  }
}

const evictExpiredEntryIfNeeded = (key: string) => {
  const entry = previewCache.get(key)
  if (!entry) return null

  if (Date.now() - entry.cachedAt <= PREVIEW_CACHE_TTL_MS) {
    return entry
  }

  previewCache.delete(key)
  previewStatus.delete(key)
  emit()
  return null
}

/**
 * Returns the cached preview snapshot for a post while it is still inside the
 * active in-memory window.
 */
export const getPreviewCacheEntry = (key: string): TPreviewCacheEntry | null => {
  return evictExpiredEntryIfNeeded(key)
}

/**
 * Stores the provider init snapshot produced by the real preview route so the
 * next reopen can render before the next RSC payload arrives.
 */
export const setPreviewCacheEntry = (entry: TPreviewCacheEntry): void => {
  previewCache.set(entry.key, entry)
  emit()
}

/**
 * Marks a preview key as waiting for the real route payload in the current
 * open cycle. The host uses this alongside the cache entry to decide whether
 * cached content should keep driving the drawer body.
 */
export const markPreviewPending = (key: string): void => {
  previewStatus.set(key, 'pending')
  emit()
}

/**
 * Marks a preview key as owned by the real route again once that tree has been
 * mounted and synced back into browser memory.
 */
export const markPreviewReady = (key: string): void => {
  previewStatus.set(key, 'ready')
  emit()
}

export const getPreviewReadyState = (key: string): boolean => previewStatus.get(key) === 'ready'

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Exposes preview cache state to client hosts. The external-store snapshot is
 * kept as a primitive version because returning a fresh object directly from
 * the snapshot reader would make React treat every read as a state change.
 */
export const usePreviewCacheState = (key: string | null) => {
  const version = useSyncExternalStore(subscribe, () => previewCacheVersion)

  return useMemo(
    () => ({
      entry: key ? getPreviewCacheEntry(key) : null,
      ready: key ? getPreviewReadyState(key) : false,
    }),
    [key, version],
  )
}
