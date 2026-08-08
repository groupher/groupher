import { createServerFn } from '@tanstack/react-start'
import { print } from 'graphql'

import type { TDocDraftInitialData } from '~/unit/DashboardThread/CMS/Docs/Editor/Article/spec'
import type { TDocTreeInitialData } from '~/unit/DashboardThread/CMS/Docs/Editor/SideTree/spec'
import type { TDocTreeNodeDTO } from '~/unit/DashboardThread/CMS/Docs/Editor/SideTree/spec'
import DashboardSchema from '~/unit/DashboardThread/schema'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

type TDocTreeQueryData = {
  docTree?: TDocTreeInitialData | null
}

type TDocDraftQueryData = {
  docDraft?: TDocDraftInitialData | null
}

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

    const treeResult = await fetchGraphQL<TDocTreeQueryData>(
      print(DashboardSchema.docTree),
      { community: data.community },
      token,
    )
    const docTree = treeResult.data?.docTree || null
    const nodes = docTree?.tabs?.flatMap((tab) => tab.groups ?? []) ?? []
    const activePage = findDocPage(nodes, data.docId) || findDocPage(nodes, null)
    const activeDocId = activePage?.docId ? String(activePage.docId) : null

    if (!activeDocId) {
      return { activeDocId: null, authRequired: false, docDraft: null, docTree }
    }

    const draftResult = await fetchGraphQL<TDocDraftQueryData>(
      print(DashboardSchema.docDraft),
      { community: data.community, id: activeDocId },
      token,
    )

    return {
      activeDocId,
      authRequired: false,
      docDraft: draftResult.data?.docDraft || null,
      docTree,
    }
  })
