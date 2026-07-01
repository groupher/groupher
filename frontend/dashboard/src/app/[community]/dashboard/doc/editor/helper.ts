import { print, type DocumentNode } from 'graphql'
import { headers } from 'next/headers'

import { GRAPHQL_ENDPOINT } from '~/config'
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
 * Convert a GraphQL document into a POST body query string.
 *
 * @example
 * schemaToString(S.docTree)
 * // => 'query docTree($community: String!) { ... }'
 */
export const schemaToString = (schema: unknown): string => {
  if (typeof schema === 'string') return schema

  return print(schema as DocumentNode)
}

/**
 * Run an authenticated dashboard GraphQL request during SSR.
 *
 * @example
 * await fetchDashboardGraphQL<TDocTreeQueryData>(S.docTree, { community: 'home' })
 * // => { docTree: { revision: 1, groups: [...] } }
 */
export const fetchDashboardGraphQL = async <TData>(
  schema: unknown,
  variables: Record<string, unknown>,
): Promise<TData | null> => {
  const headerStore = await headers()
  const cookie = headerStore.get('cookie')
  const authorization = headerStore.get('authorization')

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({
      query: schemaToString(schema),
      variables,
    }),
  })

  const payload = (await response.json()) as TGraphQLResult<TData>

  if (payload.errors) {
    console.error('## doc editor ssr graphql error: ', payload.errors)
    return null
  }

  return payload.data ?? null
}

/**
 * Resolve the first page node in the docs side tree.
 *
 * @example
 * findFirstPage([{ children: [{ type: 'page', docId: 'doc_1' }] }])
 * // => { type: 'page', docId: 'doc_1' }
 */
export const findFirstPage = (groups: readonly TDocTreeNodeDTO[]): TDocTreeNodeDTO | null => {
  for (const group of groups) {
    const page = group.children?.find(isPageNode)
    if (page) return page
  }

  return null
}

/**
 * Resolve a page node by its doc id.
 *
 * @example
 * findPageByDocId([{ children: [{ type: 'page', docId: 'doc_1' }] }], 'doc_1')
 * // => { type: 'page', docId: 'doc_1' }
 */
export const findPageByDocId = (
  groups: readonly TDocTreeNodeDTO[],
  docId: string | null,
): TDocTreeNodeDTO | null => {
  if (!docId) return null

  for (const group of groups) {
    const page = group.children?.find((child) => isPageNode(child) && String(child.docId) === docId)
    if (page) return page
  }

  return null
}

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
    const treeData = await fetchDashboardGraphQL<TDocTreeQueryData>(S.docTree, { community })
    const docTree = treeData?.docTree ?? null
    // The editor route must have a concrete doc id. If the URL is empty or stale,
    // pick the first page so SSR can hydrate matching tree + document data.
    const activePage = docTree
      ? findPageByDocId(docTree.groups, docId) || findFirstPage(docTree.groups)
      : null
    const activeDocId = activePage?.docId ?? null

    if (!docTree || !activeDocId) return { docTree, docDraft: null, activeDocId: null }

    const draftData = await fetchDashboardGraphQL<TDocDraftQueryData>(S.docDraft, {
      community,
      id: activeDocId,
    })

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
