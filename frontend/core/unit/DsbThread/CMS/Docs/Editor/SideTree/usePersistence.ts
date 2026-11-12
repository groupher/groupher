import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import type { DocumentNode } from 'graphql'
import { useCallback } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/docs'

import { reloadDocsPublishQueue } from '../helper'
import { formatMutationError } from './helper'
import type { TDocTreeMutationData, TDocTreeState } from './spec'

export type TSideTreeMutationSchema =
  | DocumentNode
  | TypedDocumentNode<TDocTreeMutationData, Record<string, unknown>>

type TParams = {
  revisionRef: { current: number | null }
  setTreeState: (state: TDocTreeState | null) => void
  setCoverWarning: (message: string | null) => void
  reload: () => void
}

/** Exposes side tree persistence state and actions through the shared React hook boundary. */
export default function useSideTreePersistence({ revisionRef, setCoverWarning, reload }: TParams) {
  const { slug: community } = useCommunity()

  const persistCoverAction = useCallback(
    async (
      schema: DocumentNode | TypedDocumentNode<unknown, Record<string, unknown>>,
      variables: Record<string, unknown>,
    ): Promise<boolean> => {
      try {
        type TCoverVariables = Record<string, unknown> & { commandId: string }
        await executeCommand<TCoverVariables, unknown>({
          request: (transportVariables) => browserGraphQLRequest(schema, transportVariables),
          variables: { community, ...variables } as Omit<TCoverVariables, 'commandId'>,
        })
        reload()
        return true
      } catch (err) {
        const message = formatMutationError(err)
        setCoverWarning(message)
        reload()
        return false
      }
    },
    [community, reload, setCoverWarning],
  )

  const persistWorkspaceUpdate = useCallback(
    async (nodeId: string, patch: Record<string, unknown>): Promise<void> => {
      if (revisionRef.current === null) {
        reload()
        return
      }
      try {
        const data = await executeCommand({
          request: (variables) =>
            browserGraphQLRequest<{
              updateDocsWorkspaceNode?: { treeRevision: number } | null
            }>(S.updateDocsWorkspaceNode, variables),
          variables: { community, treeRevision: revisionRef.current, nodeId, patch },
        })
        if (!data?.updateDocsWorkspaceNode) throw new Error('Directory update failed')
        revisionRef.current = data.updateDocsWorkspaceNode.treeRevision
        reloadDocsPublishQueue()
        reload()
      } catch (err) {
        toast(formatMutationError(err), 'error')
        reload()
      }
    },
    [community, reload, revisionRef],
  )

  const persistWorkspaceMove = useCallback(
    async (nodeId: string, parentNodeId: string | null, position: number): Promise<void> => {
      if (revisionRef.current === null) {
        reload()
        return
      }
      try {
        const data = await executeCommand({
          request: (variables) =>
            browserGraphQLRequest<{
              moveDocsWorkspaceNode?: { treeRevision: number } | null
            }>(S.moveDocsWorkspaceNode, variables),
          variables: {
            community,
            treeRevision: revisionRef.current,
            nodeId,
            parentNodeId,
            position,
          },
        })
        if (!data?.moveDocsWorkspaceNode) throw new Error('Directory move failed')
        revisionRef.current = data.moveDocsWorkspaceNode.treeRevision
        reloadDocsPublishQueue()
        reload()
      } catch (err) {
        toast(formatMutationError(err), 'error')
        reload()
      }
    },
    [community, reload, revisionRef],
  )

  return {
    persistCoverAction,
    persistWorkspaceUpdate,
    persistWorkspaceMove,
  }
}
