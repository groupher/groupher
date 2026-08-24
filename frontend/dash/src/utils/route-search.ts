const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

export type TCommunityRouteSearch = {
  lang?: string
  mode?: string
}

/** Keeps only supported community-shell search parameters from the router input. */
export const validateCommunitySearch = (
  search: Record<string, unknown>,
): TCommunityRouteSearch => ({
  lang: optionalString(search.lang),
  mode: optionalString(search.mode),
})

export type TDocEditorRouteSearch = {
  docId?: string
}

/** Keeps the optional document editor identity from the router search input. */
export const validateDocEditorSearch = (
  search: Record<string, unknown>,
): TDocEditorRouteSearch => ({
  docId: optionalString(search.docId),
})
