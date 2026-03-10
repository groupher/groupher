/**
 * Session-level image cache used by Img components.
 *
 * Purpose:
 * - Avoid fallback/avatar flicker after route switches remount image components.
 * - If a `src` was loaded once in current SPA session, treat it as warm on next mount.
 *
 * Design choices:
 * - In-memory only (cleared on full page reload).
 * - Cache success only; do not cache failures so transient errors can recover.
 * - Bounded size to prevent unbounded memory growth.
 */
const MAX_CACHED_SRCS = 500

const loadedSrcCache = new Set<string>()

export const hasLoadedSrc = (src: string): boolean => {
  if (!src) return false
  return loadedSrcCache.has(src)
}

export const markLoadedSrc = (src: string): void => {
  if (!src) return

  if (loadedSrcCache.has(src)) {
    loadedSrcCache.delete(src)
  }

  loadedSrcCache.add(src)

  if (loadedSrcCache.size <= MAX_CACHED_SRCS) return

  const oldestSrc = loadedSrcCache.values().next().value
  if (oldestSrc) {
    loadedSrcCache.delete(oldestSrc)
  }
}
