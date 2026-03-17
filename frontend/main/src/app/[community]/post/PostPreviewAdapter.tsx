'use client'

import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'

import { getPreviewCacheKey, PreviewHost, type TPreviewPhase } from '../_preview'
import type { TPostPreviewCacheEntry } from './buildPreviewCacheEntry'
import PreviewRuntime from './PreviewRuntime'

type TProps = {
  children: ReactNode
}

/**
 * Thin adapter bridge: post owns how preview keys are derived and how cached
 * preview content is rendered, while the shared host owns drawer/cache phases.
 */
export default function PostPreviewAdapter({ children }: TProps) {
  return (
    <PreviewHost<TPostPreviewCacheEntry>
      resolvePreviewKey={(communitySlug, id) =>
        communitySlug && id ? getPreviewCacheKey(communitySlug, THREAD.POST, id) : null
      }
      renderPreview={(entry, phase: TPreviewPhase) => (
        <PreviewRuntime key={`${entry.key}:${phase}`} entry={entry} phase={phase} />
      )}
    >
      {children}
    </PreviewHost>
  )
}
