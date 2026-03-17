'use client'

import ArticleViewer from '~/containers/viewer/ArticleViewer'
import ArticleStoreProvider from '~/stores/article/provider'
import CommentsStoreProvider from '~/stores/comments/provider'

import type { TPreviewPhase } from '../_preview'
import type { TPostPreviewCacheEntry } from './buildPreviewCacheEntry'

type TProps = {
  entry: TPostPreviewCacheEntry
  phase?: TPreviewPhase
}

/**
 * Cached preview and route preview must share the same runtime tree so article
 * and comments UI keep a single rendering source of truth.
 */
export default function PreviewRuntime({ entry, phase = 'live' }: TProps) {
  return (
    <ArticleStoreProvider initData={entry.articleInitData}>
      <CommentsStoreProvider initData={entry.commentsInitData}>
        <ArticleViewer
          community={entry.communitySlug}
          innerId={Number(entry.innerId)}
          thread='post'
          isFullView={phase !== 'cached-lite'}
        />
      </CommentsStoreProvider>
    </ArticleStoreProvider>
  )
}
