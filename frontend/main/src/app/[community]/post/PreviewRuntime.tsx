'use client'

import ArticleViewer from '~/containers/viewer/ArticleViewer'
import ArticleStoreProvider from '~/stores/article/provider'
import CommentsStoreProvider from '~/stores/comments/provider'

import type { TPreviewCacheEntry } from '../_preview/spec'

type TProps = {
  entry: TPreviewCacheEntry
  mode?: 'lite' | 'full'
}

/**
 * Cached preview and route preview must share the same runtime tree so article
 * and comments UI keep a single rendering source of truth.
 */
export default function PreviewRuntime({ entry, mode = 'full' }: TProps) {
  return (
    <ArticleStoreProvider initData={entry.articleInitData}>
      <CommentsStoreProvider initData={entry.commentsInitData}>
        <ArticleViewer
          community={entry.communitySlug}
          innerId={entry.innerId}
          thread='post'
          mode={mode}
        />
      </CommentsStoreProvider>
    </ArticleStoreProvider>
  )
}
