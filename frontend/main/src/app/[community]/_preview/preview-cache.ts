'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { TPreviewCacheEntryBase } from './spec'

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000

const previewCache = new Map<string, TPreviewCacheEntryBase>()
const previewStatus = new Map<string, 'pending' | 'ready'>()
const listeners = new Set<() => void>()
let previewCacheVersion = 0

const emit = () => {
  previewCacheVersion += 1
  for (const listener of listeners) {
    listener()
  }
}

const getFreshEntry = (key: string) => {
  const entry = previewCache.get(key)
  if (!entry) return null

  if (Date.now() - entry.cachedAt <= PREVIEW_CACHE_TTL_MS) {
    return entry
  }

  return null
}

const cleanupExpiredEntry = (key: string) => {
  const entry = previewCache.get(key)
  if (!entry) return
  if (Date.now() - entry.cachedAt <= PREVIEW_CACHE_TTL_MS) return

  previewCache.delete(key)
  previewStatus.delete(key)
  emit()
}

/**
 * Returns the cached preview snapshot for a post while it is still inside the
 * active in-memory window.
 */
export const getPreviewCacheEntry = <
  TEntry extends TPreviewCacheEntryBase = TPreviewCacheEntryBase,
>(
  key: string,
): TEntry | null => {
  return getFreshEntry(key) as TEntry | null
}

/**
 * Stores the provider init snapshot produced by the real preview route so the
 * next reopen can render before the next RSC payload arrives.
 */
export const setPreviewCacheEntry = <
  TEntry extends TPreviewCacheEntryBase = TPreviewCacheEntryBase,
>(
  entry: TEntry,
): void => {
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
export const usePreviewCacheState = <
  TEntry extends TPreviewCacheEntryBase = TPreviewCacheEntryBase,
>(
  key: string | null,
) => {
  const version = useSyncExternalStore(
    subscribe,
    () => previewCacheVersion,
    () => previewCacheVersion,
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!key) return
    cleanupExpiredEntry(key)
  }, [key, version])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  return useMemo(
    () => ({
      entry: key ? getPreviewCacheEntry<TEntry>(key) : null,
      ready: key ? getPreviewReadyState(key) : false,
    }),
    [key, version],
  )
}
