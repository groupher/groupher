import { DOC_EDITOR_QUERY_PARAM } from '../../constant'
import { SIDE_TREE_NODE_TYPE } from '../constant'
import type { TSideTreeChild } from '../spec'

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'ftp:', 'mailto:', 'tel:'])

/**
 * Build the editor URL after applying or clearing the active doc id query.
 *
 * @example
 * const nextUrl = buildDocEditorUrl('/home/dashboard/doc/editor', 'foo=1', '42')
 * nextUrl.includes('docId=42')
 */
export const buildDocEditorUrl = (
  pathname: string,
  searchString: string,
  docId: string | null,
): string => {
  const nextSearchParams = new URLSearchParams(searchString)

  if (docId) {
    nextSearchParams.set(DOC_EDITOR_QUERY_PARAM.DOC_ID, docId)
  } else {
    nextSearchParams.delete(DOC_EDITOR_QUERY_PARAM.DOC_ID)
  }

  const nextQuery = nextSearchParams.toString()
  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

/**
 * Resolve the URL doc id from a selected page child.
 *
 * @example
 * const docId = getDocIdFromPage(activePage)
 * syncDocIdToUrl(docId)
 */
export const getDocIdFromPage = (page: TSideTreeChild | null): string | null =>
  page?.type === SIDE_TREE_NODE_TYPE.PAGE && page.docId ? page.docId : null

export const isLinkHref = (href: string): boolean => {
  const value = href.trim()
  if (!value) return false

  try {
    return LINK_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

export const getDefaultLinkTitle = (href: string): string => {
  const value = href.trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    if (url.hostname) return url.hostname.replace(/^www\./, '')

    return url.pathname || value
  } catch {
    return value
  }
}
