import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import type { DocumentNode } from 'graphql'
import { useCallback } from 'react'

import { browserQuery } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'

import { reloadDocPublishChecklist } from '../helper'
import { formatMutationError } from './helper'
import type { TDocTreeMutationData, TDocTreeMutationPayload, TDocTreeState } from './spec'

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
export default function useSideTreePersistence({
  revisionRef,
  setTreeState,
  setCoverWarning,
  reload,
}: TParams) {
  const { t } = useTrans()
  const { slug: community } = useCommunity()

  const persist = useCallback(
    async (
      schema: TSideTreeMutationSchema,
      variables: Record<string, unknown>,
      pickPayload: (data: TDocTreeMutationData) => TDocTreeMutationPayload | null | undefined,
    ): Promise<TDocTreeMutationPayload | null | undefined> => {
      try {
        const data = await browserQuery<TDocTreeMutationData>(schema, {
          community,
          baseRevision: revisionRef.current,
          ...variables,
        })
        const payload = pickPayload(data)

        if (payload?.conflict) {
          reload()
          toast(t('dsb.cms.docs.side_tree.error.tree_conflict'), 'error')
          return payload
        }

        if (payload) {
          revisionRef.current = payload.revision
          setTreeState(payload.treeState ?? null)
          reloadDocPublishChecklist()
        }

        return payload
      } catch (err) {
        console.error('## doc tree mutation error: ', err)
        toast(formatMutationError(err), 'error')
        reload()
        return null
      }
    },
    [community, reload, revisionRef, setTreeState, t],
  )

  const persistCoverAction = useCallback(
    async (
      schema: DocumentNode | TypedDocumentNode<unknown, Record<string, unknown>>,
      variables: Record<string, unknown>,
    ): Promise<boolean> => {
      try {
        await browserQuery(schema, { community, ...variables })
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

  return {
    persist,
    persistCoverAction,
  }
}
