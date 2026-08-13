import type { TArticle } from '~/spec'

export * from './useMultiSelection'
export * from './useScrollStuck'
export * from './useStickyColumns'

export type TSortDir = 'asc' | 'desc' | false

/** Returns article row id for the frontend shared workflow. */
export const getArticleRowId = (row: TArticle, index?: number) => {
  const slug = row.community?.slug ?? 'unknown'
  const innerId = row.innerId ?? `no_inner_${index ?? 'x'}`
  return `${slug}:${innerId}`
}
