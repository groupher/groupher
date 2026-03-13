'use client'

import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'

import ThreadPreviewDrawerHost from '../_preview/ThreadPreviewDrawerHost'
import { getPreviewCacheKey } from './buildPreviewCacheEntry'
import PreviewRuntime from './PreviewRuntime'

type TProps = {
  children: ReactNode
}

/**
 * Thin adapter bridge: post owns how preview keys are derived and how cached
 * preview content is rendered, while the shared host owns drawer/cache phases.
 */
export default function PostPreviewDrawerHost({ children }: TProps) {
  return (
    <ThreadPreviewDrawerHost
      resolvePreviewKey={(communitySlug, id) =>
        communitySlug && id ? getPreviewCacheKey(communitySlug, THREAD.POST, id) : null
      }
      renderCachedPreview={(entry, mode) => (
        <PreviewRuntime key={`${entry.key}:${mode}`} entry={entry} mode={mode} />
      )}
    >
      {children}
    </ThreadPreviewDrawerHost>
  )
}
