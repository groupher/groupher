import type { TComment } from '~/spec'

type TPage = {
  entries: TComment[]
  pinnedEntries?: TComment[]
  pageInfo?: { api: string; page?: number; hasNextPage?: boolean }
}

/** Rebuilds a page only when its entity arrays changed, preserving all page metadata. */
export const withPageEntries = (
  page: TPage,
  entries: TComment[],
  pinnedEntries?: TComment[],
): TPage => {
  if (entries === page.entries && pinnedEntries === page.pinnedEntries) return page
  return {
    ...page,
    entries,
    ...(page.pinnedEntries && pinnedEntries ? { pinnedEntries } : {}),
  }
}

const record = (data: unknown): data is Record<string, unknown> =>
  !!data && typeof data === 'object'

/** Traverses actual query pages, preserving InfiniteData pageParams and independent page metadata. */
export const mapCommentPages = (
  data: unknown,
  update: (page: TPage, index: number, pageParam?: unknown, hasPageParams?: boolean) => TPage,
): unknown => {
  if (!record(data)) return data
  if (Array.isArray(data.pages)) {
    let changed = false
    const pageParams = Array.isArray(data.pageParams) ? data.pageParams : undefined
    const pages = data.pages.map((page, index) => {
      if (!record(page) || !Array.isArray(page.entries)) return page
      const next = update(page as TPage, index, pageParams?.[index], pageParams !== undefined)
      if (next !== page) changed = true
      return next
    })
    return changed ? { ...data, pages } : data
  }
  return Array.isArray(data.entries) ? update(data as TPage, 0) : data
}
/** Applies an entry projection to every cached page and its pinned entries. */
export const mapCommentEntries = (
  data: unknown,
  update: (entries: TComment[]) => TComment[],
): unknown =>
  mapCommentPages(data, (page) => {
    const entries = update(page.entries)
    const pinnedEntries = page.pinnedEntries ? update(page.pinnedEntries) : undefined
    return withPageEntries(page, entries, pinnedEntries)
  })
/** Collects loaded root and pinned entries across offset or infinite cache pages. */
export const commentCacheEntries = (data: unknown): TComment[] => {
  const entries: TComment[] = []
  mapCommentPages(data, (page) => {
    entries.push(...page.entries, ...(page.pinnedEntries || []))
    return page
  })
  return entries
}
/** Recovers a comment collection identity and its original cursor from a query key. */
export const commentCollectionOf = (key: readonly unknown[]) => {
  if (key[5] !== 'page') return undefined
  const collection = key[6] as { rootInnerId?: string; mode?: string; sort?: string }
  const position = key[8] as { after?: string }
  return { ...collection, initialAfter: position.after }
}
