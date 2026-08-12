import { createServerFn } from '@tanstack/react-start'

import type { TDocDraftInitialData } from '~/unit/DashboardThread/CMS/Docs/Editor/Article/spec'
import type { TDocTreeInitialData } from '~/unit/DashboardThread/CMS/Docs/Editor/SideTree/spec'
import type { TDocTreeNodeDTO } from '~/unit/DashboardThread/CMS/Docs/Editor/SideTree/spec'
import DashboardDocsSchema from '~/unit/DashboardThread/schema/docs'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

export type TDocEditorInitialData = {
  activeDocId: string | null
  authRequired: boolean
  docDraft?: TDocDraftInitialData | null
  docTree?: TDocTreeInitialData | null
}

const isDocPageNode = (node: TDocTreeNodeDTO): boolean => String(node.type).toLowerCase() === 'page'

const findDocPage = (
  nodes: readonly TDocTreeNodeDTO[],
  docId: string | null,
): TDocTreeNodeDTO | null => {
  for (const node of nodes) {
    if (isDocPageNode(node) && (!docId || String(node.docId) === docId)) return node

    const page = findDocPage(node.pages ?? [], docId)
    if (page) return page
  }

  return null
}

export const loadDocEditorData = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; docId: string | null }) => data)
  .handler(async ({ data }): Promise<TDocEditorInitialData> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    if (!token) {
      return { activeDocId: null, authRequired: true, docDraft: null, docTree: null }
    }

    const treeResult = await fetchGraphQL(
      DashboardDocsSchema.docTree,
      { community: data.community },
      token,
    )
    const docTree = (treeResult.data?.docTree as unknown as TDocTreeInitialData | null) || null
    const nodes = docTree?.tabs?.flatMap((tab) => tab.groups ?? []) ?? []
    const activePage = findDocPage(nodes, data.docId) || findDocPage(nodes, null)
    const activeDocId = activePage?.docId ? String(activePage.docId) : null

    if (!activeDocId) {
      return { activeDocId: null, authRequired: false, docDraft: null, docTree }
    }

    const draftResult = await fetchGraphQL(
      DashboardDocsSchema.docDraft,
      { community: data.community, id: activeDocId },
      token,
    )
    const docDraft = (draftResult.data?.docDraft as unknown as TDocDraftInitialData | null) || null

    return {
      activeDocId,
      authRequired: false,
      docDraft,
      docTree,
    }
  })
