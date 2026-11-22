import { createServerFn } from '@tanstack/react-start'

import { findFirstPage } from '~/unit/DsbThread/CMS/Docs/Editor/SideTree/helper/tree'
import { workspaceTabs } from '~/unit/DsbThread/CMS/Docs/Editor/SideTree/helper/workspace'
import type { TWorkspaceNode } from '~/unit/DsbThread/CMS/Docs/Editor/SideTree/spec'
import DashboardDocsSchema from '~/unit/DsbThread/schema/docs'

import { fetchGraphQL, getAuthToken, GraphQLRequestError, setPrivateCacheHeader } from './graphql'

// CMS deliberately returns Community not-found when a caller cannot see the
// Admin-scoped resource, preventing membership enumeration.
const COMMUNITY_NOT_ACCESSIBLE_CODE = 5504

export type TDocEditorInitialData = {
  accessDenied: boolean
  activeDocId: string | null
}

export const loadDocEditorData = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; docId: string | null }) => data)
  .handler(async ({ data }): Promise<TDocEditorInitialData> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    if (!token) {
      return {
        accessDenied: false,
        activeDocId: null,
      }
    }

    const treeResult = await fetchGraphQL(
      DashboardDocsSchema.docsWorkspaceTree,
      { community: data.community },
      token,
    ).catch((error: unknown) => {
      if (
        error instanceof GraphQLRequestError &&
        error.backendCode === COMMUNITY_NOT_ACCESSIBLE_CODE
      ) {
        return null
      }

      throw error
    })

    if (!treeResult) {
      return {
        accessDenied: true,
        activeDocId: null,
      }
    }
    const nodes = (treeResult.data?.docsWorkspaceTree?.nodes ?? []) as TWorkspaceNode[]
    const requested = nodes.find((node) => node.type === 'PAGE' && node.docId === data.docId)
    const first = workspaceTabs(nodes)
      .map((tab) => findFirstPage(tab.groups))
      .find(Boolean)
    const activeDocId = requested?.docId ?? (first && 'docId' in first ? first.docId : null) ?? null

    return {
      accessDenied: false,
      activeDocId,
    }
  })
