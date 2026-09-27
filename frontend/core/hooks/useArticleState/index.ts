'use client'

import { useMemo } from 'react'

import type { TArticle } from '~/spec'

import useArticleStates, { type TArticleState } from '../useArticleStates'

/** Returns the shared state projection for one Article detail view. */
export default function useArticleState<T extends TArticle>(
  article: T | null | undefined,
): TArticleState<T> | null {
  const articles = useMemo(() => (article ? [article] : []), [article])
  return useArticleStates(articles)[0] || null
}
