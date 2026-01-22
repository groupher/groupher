import type { TArticle } from '~/spec'

export * from './useMultiSelection'
export * from './useStickyColumns'

export type TSortDir = 'asc' | 'desc' | false

export const getArticleRowId = (row: TArticle, index?: number) => {
  const slug = row.communitySlug ?? row.community?.slug ?? 'unknown'
  const innerId = row.innerId ?? `no_inner_${index ?? 'x'}`
  return `${slug}:${innerId}`
}
