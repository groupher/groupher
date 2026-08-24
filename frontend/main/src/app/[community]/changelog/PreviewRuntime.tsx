'use client'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentQuerySeed from '~/query/CommentQuerySeed'
import CommentsStoreProvider from '~/stores/comments/provider'
import ArticleViewer from '~/unit/ArticleView'

import { isLitePreviewPhase, type TPreviewPhase } from '../_preview'
import type { TChangelogPreviewCacheEntry } from './buildPreviewCacheEntry'

type TProps = {
  entry: TChangelogPreviewCacheEntry
  phase?: TPreviewPhase
}

/**
 * Cached preview and route preview must share the same runtime tree so article
 * and comments UI keep a single rendering source of truth.
 */
export default function PreviewRuntime({ entry, phase }: TProps) {
  return (
    <ArticleQueryProvider
      community={entry.communitySlug}
      innerId={entry.innerId}
      thread={THREAD.CHANGELOG}
      initialArticle={entry.articleInitData.changelog}
    >
      <CommentQuerySeed
        community={entry.communitySlug}
        innerId={entry.innerId}
        thread={THREAD.CHANGELOG}
        initialComments={
          'pagedComments' in entry.commentsInitData
            ? entry.commentsInitData.pagedComments
            : undefined
        }
      >
        <CommentsStoreProvider>
          <ArticleViewer
            community={entry.communitySlug}
            innerId={Number(entry.innerId)}
            thread={THREAD.CHANGELOG}
            isFullView={!phase || !isLitePreviewPhase(phase)}
          />
        </CommentsStoreProvider>
      </CommentQuerySeed>
    </ArticleQueryProvider>
  )
}
