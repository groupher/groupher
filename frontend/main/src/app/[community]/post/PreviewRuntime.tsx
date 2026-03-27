'use client'

import { THREAD } from '~/const/thread'
import ArticleStoreProvider from '~/stores/article/provider'
import CommentsStoreProvider from '~/stores/comments/provider'
import ArticleViewer from '~/unit/ArticleView'

import { isLitePreviewPhase, type TPreviewPhase } from '../_preview'
import type { TPostPreviewCacheEntry } from './buildPreviewCacheEntry'

type TProps = {
  entry: TPostPreviewCacheEntry
  phase?: TPreviewPhase
}

/**
 * Cached preview and route preview must share the same runtime tree so article
 * and comments UI keep a single rendering source of truth.
 */
export default function PreviewRuntime({ entry, phase }: TProps) {
  return (
    <ArticleStoreProvider initData={entry.articleInitData}>
      <CommentsStoreProvider initData={entry.commentsInitData}>
        <ArticleViewer
          community={entry.communitySlug}
          innerId={Number(entry.innerId)}
          thread={THREAD.POST}
          isFullView={!phase || !isLitePreviewPhase(phase)}
        />
      </CommentsStoreProvider>
    </ArticleStoreProvider>
  )
}
