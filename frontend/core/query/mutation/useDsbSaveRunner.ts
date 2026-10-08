'use client'

import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { clone } from 'ramda'

import useTrans from '~/hooks/useTrans'
import { dsbKeys, dsbMutationKeys } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TDsbFieldMap, TParseDashboard } from '~/spec'
import type { TDsbEditStore } from '~/stores/dsbEdit/spec'
import { toast } from '~/ui/Toaster'
import type { TDsbEditableFieldKey, TDsbFieldKey } from '~/unit/DsbThread/spec'

import type { TDsbConfirmedReader } from './dsb/types'

export type TDsbSaveExecution = {
  execute: (commandId: string) => Promise<unknown>
  field: TDsbFieldKey
  submitted: Partial<TDsbFieldMap>
  savedFields: readonly TDsbEditableFieldKey[]
  readConfirmed?: TDsbConfirmedReader
  afterConfirmed?: (data: unknown) => void
}

type TArgs = {
  community: string
  dashboardStore: TDsbEditStore
}

/** Owns only transport lifecycle, confirmed Query update, and editor reconcile. */
export default function useDsbSaveRunner({ community, dashboardStore }: TArgs) {
  const queryClient = useQueryClient()
  const { t } = useTrans()
  const mutationKey = dsbMutationKeys.save(community)

  const confirm = (request: TDsbSaveExecution, data: unknown): void => {
    const responsePatch = request.readConfirmed?.(data) ?? {}
    const confirmed = {} as Partial<TDsbFieldMap>
    let responseComplete = Boolean(request.readConfirmed)

    for (const field of request.savedFields) {
      const responseValue = responsePatch[field]
      if (responseValue === undefined) {
        responseComplete = false
        confirmed[field] = clone(request.submitted[field]) as never
      } else {
        confirmed[field] = clone(responseValue) as never
      }
    }

    queryClient.setQueryData<TParseDashboard>(dsbKeys.config(community), (previous) =>
      previous
        ? { ...previous, ...confirmed, original: { ...previous.original, ...confirmed } }
        : previous,
    )
    if (!responseComplete) {
      void invalidate(queryClient, QueryInvalidation.community.dashboard(community))
    }

    dashboardStore.reconcile({
      fields: request.savedFields,
      submitted: request.submitted,
      confirmed,
    })
    request.afterConfirmed?.(data)
  }

  const saveMutation = useMutation({
    mutationKey,
    mutationFn: (request: TDsbSaveExecution) =>
      executeCommand<{ commandId: string }, unknown>({
        request: ({ commandId }) => request.execute(commandId),
        variables: {},
      }),
    onSuccess: (data, request) => {
      confirm(request, data)
      toast(t('dsb.appearance.saved'))
    },
    onError: (error) => {
      console.error('## save dashboard field error: ', error)
      toast(String(error), 'error')
    },
  })

  return {
    save: saveMutation.mutate,
    isPending: useIsMutating({ mutationKey: dsbMutationKeys.save() }) > 0,
    error: saveMutation.error as Error | null,
  }
}
