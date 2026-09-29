'use client'

import { useMemo } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'
import type { TComment } from '~/spec'

import { articlePathKey, articlePathOf } from '../articlePath'
import type { TCommentTarget } from './comment'

/** Builds the article-scoped target shared by Comment reaction Hooks. */
export default function useCommentTarget(comment: TComment): TCommentTarget {
  const { article } = useViewingArticle()
  const community = article.community.slug
  const thread = article.meta.thread
  const articleInnerId = String(article.innerId)
  const commentInnerId = String(comment.innerId)

  return useMemo(() => {
    const articlePath = articlePathOf(article)
    return {
      comment,
      articlePath,
      articleKey: articlePathKey(articlePath),
      commentInnerId,
      commentPath: { article: articlePath, innerId: commentInnerId },
      scope: { community, thread, articleInnerId },
    }
  }, [article, articleInnerId, comment, commentInnerId, community, thread])
}
