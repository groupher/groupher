import { getResponseHeader, setResponseHeader } from '@tanstack/react-start/server'

import {
  PUBLIC_CACHE_FRESH_SECONDS,
  PUBLIC_CACHE_STALE_WHILE_REVALIDATE_SECONDS,
} from '~/constant/cache'

const splitTags = (value: string | string[] | undefined): string[] => {
  const values = Array.isArray(value) ? value : value ? [value] : []
  return values
    .flatMap((item) => item.split(','))
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** Merges route-loader tags so nested server functions cannot overwrite prior cache ownership. */
export const mergeCacheTags = (
  current: string | string[] | undefined,
  incoming: readonly string[],
): string[] => [...new Set([...splitTags(current), ...incoming])]

/** Applies the shared public cache policy and accumulates semantic tags for the whole request. */
export const setPublicCacheHeaders = (tags: readonly string[]): void => {
  setResponseHeader(
    'cache-control',
    `public, s-maxage=${PUBLIC_CACHE_FRESH_SECONDS}, stale-while-revalidate=${PUBLIC_CACHE_STALE_WHILE_REVALIDATE_SECONDS}`,
  )
  const merged = mergeCacheTags(getResponseHeader('cache-tag'), tags)
  setResponseHeader('cache-tag', merged.join(', '))
}
