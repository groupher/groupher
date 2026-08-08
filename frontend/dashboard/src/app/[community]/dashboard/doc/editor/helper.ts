import { gqFetch } from '~/graphql/server'
import type { TDocTreeNodeDTO } from '~/unit/DashboardThread/CMS/Docs/Editor/SideTree/spec'
import S from '~/unit/DashboardThread/schema'

import type {
  TDocDraftQueryData,
  TDocEditorInitialDataResult,
  TDocTreeQueryData,
  TGraphQLResult,
} from './spec'

const isPageNode = (node: TDocTreeNodeDTO): boolean => String(node.type).toLowerCase() === 'page'

/**
 * Normalize one Next.js search param value into a single string.
 *
 * @example
 * getSearchValue(['doc_1', 'doc_2'])
 * // => 'doc_1'
 */
export const getSearchValue = (value?: string | string[]): string | null => {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Resolve the first page node in the docs side tree.
 *
 * @example
 * findFirstPage([{ pages: [{ type: 'page', docId: 'doc_1' }] }])
 * // => { type: 'page', docId: 'doc_1' }
 */
export const findFirstPage = (nodes: readonly TDocTreeNodeDTO[]): TDocTreeNodeDTO | null => {
  for (const node of nodes) {
    if (isPageNode(node)) return node
    const page = findFirstPage(node.pages ?? [])
    if (page) return page
  }

  return null
}

/**
 * Resolve a page node by its doc id.
 *
 * @example
 * findPageByDocId([{ pages: [{ type: 'page', docId: 'doc_1' }] }], 'doc_1')
 * // => { type: 'page', docId: 'doc_1' }
 */
export const findPageByDocId = (
  nodes: readonly TDocTreeNodeDTO[],
  docId: string | null,
): TDocTreeNodeDTO | null => {
  if (!docId) return null

  for (const node of nodes) {
    if (isPageNode(node) && String(node.docId) === docId) return node
    const page = findPageByDocId(node.pages ?? [], docId)
    if (page) return page
  }

  return null
}

/** Resolve the Tab-owned Group roots used by all recursive editor traversal. */
export const getDocTreeGroups = (tabs: readonly TDocTreeNodeDTO[]): readonly TDocTreeNodeDTO[] =>
  tabs.flatMap((tab) => tab.groups ?? [])

/**
 * Fetch the docs editor SSR payload for the selected docId.
 *
 * @example
 * await getDocEditorInitialData('home', 'doc_welcome')
 * // => { docTree: { ... }, docDraft: { docId: 'doc_welcome', ... } }
 */
export const getDocEditorInitialData = async (
  community: string,
  docId: string | null,
): Promise<TDocEditorInitialDataResult> => {
  try {
    const treeResponse = await gqFetch(S.docTree, { community })
    const treePayload = (await treeResponse.json()) as TGraphQLResult<TDocTreeQueryData>
    const treeData = treePayload.data ?? null
    const docTree = treeData?.docTree ?? null
    // The editor route must have a concrete doc id. If the URL is empty or stale,
    // pick the first page so SSR can hydrate matching tree + document data.
    const nodes = getDocTreeGroups(docTree?.tabs ?? [])
    const activePage = docTree ? findPageByDocId(nodes, docId) || findFirstPage(nodes) : null
    const activeDocId = activePage?.docId ?? null

    if (!docTree || !activeDocId) return { docTree, docDraft: null, activeDocId: null }

    const draftResponse = await gqFetch(S.docDraft, {
      community,
      id: activeDocId,
    })
    const draftPayload = (await draftResponse.json()) as TGraphQLResult<TDocDraftQueryData>
    const draftData = draftPayload.data ?? null

    return {
      docTree,
      docDraft: draftData?.docDraft ?? null,
      activeDocId,
    }
  } catch (err) {
    console.error('## doc editor ssr error: ', err)
    return { docTree: null, docDraft: null, activeDocId: null }
  }
}
