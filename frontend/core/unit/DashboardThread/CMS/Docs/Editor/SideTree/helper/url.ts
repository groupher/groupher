import { DOC_EDITOR_QUERY_PARAM } from '../../constant'
import { SIDE_TREE_NODE_TYPE } from '../constant'
import type { TSideTreeChild } from '../spec'

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
