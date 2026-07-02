import type { AnyVariables, DocumentInput } from '@urql/core'
import { type MutableRefObject, useCallback } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import { send } from '~/lib/signal'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/widgets/Toaster'

import { formatMutationError } from './helper'
import type { TDocTreeMutationData, TDocTreeMutationPayload, TDocTreeState } from './spec'

export type TSideTreeMutationSchema = DocumentInput<TDocTreeMutationData, AnyVariables>

type TParams = {
  revisionRef: MutableRefObject<number | null>
  setTreeState: (state: TDocTreeState | null) => void
  setCoverWarning: (message: string | null) => void
  reload: () => void
}

export const reloadDocPublishScope = (): void => {
  send(DSB_DOC_EVENT.PUBLISH_SCOPE_RELOAD)
}

export default function useSideTreePersistence({
  revisionRef,
  setTreeState,
  setCoverWarning,
  reload,
}: TParams) {
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()

  const persist = useCallback(
    async (
      schema: TSideTreeMutationSchema,
      variables: Record<string, unknown>,
      pickPayload: (data: TDocTreeMutationData) => TDocTreeMutationPayload | null | undefined,
    ): Promise<TDocTreeMutationPayload | null | undefined> => {
      try {
        const data = await mutate<TDocTreeMutationData>(schema, {
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
          reloadDocPublishScope()
        }

        return payload
      } catch (err) {
        console.error('## doc tree mutation error: ', err)
        toast(formatMutationError(err), 'error')
        reload()
        return null
      }
    },
    [community, mutate, reload, revisionRef, setTreeState, t],
  )

  const persistCoverAction = useCallback(
    async (
      schema: DocumentInput<unknown, AnyVariables>,
      variables: Record<string, unknown>,
    ): Promise<boolean> => {
      try {
        await mutate(schema, { community, ...variables })
        reload()
        return true
      } catch (err) {
        const message = formatMutationError(err)
        setCoverWarning(message)
        reload()
        return false
      }
    },
    [community, mutate, reload, setCoverWarning],
  )

  return {
    persist,
    persistCoverAction,
  }
}
