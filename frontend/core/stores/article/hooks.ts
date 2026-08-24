'use client'

import { THREAD } from '~/const/thread'
import { useArticleQueryContext } from '~/query/ArticleQueryProvider'
import type { TChangelog, TDoc, TPost } from '~/spec'

import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useArticleStore = createStoreHook(StoreContext)

/** Reads article server state from the strict TanStack Query route boundary. */
export default function useArticle() {
  const queryArticle = useArticleQueryContext()
  if (!queryArticle) {
    throw new Error('useArticle must be used within an ArticleQueryProvider')
  }

  const { article, thread } = queryArticle

  return {
    article,
    post: thread === THREAD.POST ? (article as TPost | null) : null,
    changelog: thread === THREAD.CHANGELOG ? (article as TChangelog | null) : null,
    doc: thread === THREAD.DOC ? (article as TDoc | null) : null,
    thread,
  }
}

/** Reads Article-local UI state without requiring an article server-state query. */
export const useArticleUI = () => useArticleStore()
