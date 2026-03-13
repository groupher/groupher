'use client'

import { useEffect } from 'react'

import { markPreviewReady, setPreviewCacheEntry } from './hooks'
import type { TPreviewCacheEntryBase } from './spec'

type TProps = {
  entry: TPreviewCacheEntryBase
}

/**
 * The intercepted route stays authoritative. Once it resolves, write the same
 * payload back into browser memory and mark the key ready so the host can stop
 * showing cached content for this open cycle.
 */
export default function PreviewCacheSync({ entry }: TProps) {
  useEffect(() => {
    setPreviewCacheEntry(entry)
    markPreviewReady(entry.key)
  }, [entry])

  return null
}
