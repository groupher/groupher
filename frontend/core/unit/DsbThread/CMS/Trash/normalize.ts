import type { TTrashedPost, TRawTrashedPost } from './spec'

/** Moves the management-only nested ArticleStats selection into the Trash row view model. */
export const normalizeTrashedPost = (entry: TRawTrashedPost): TTrashedPost => {
  const { article, ...row } = entry
  if (!article) return { ...row, article: null, stats: null }

  const { articleStats, ...content } = article
  return { ...row, article: content, stats: articleStats ?? null }
}
