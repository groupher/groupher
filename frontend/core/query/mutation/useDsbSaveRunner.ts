'use client'

import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { clone } from 'ramda'

import useTrans from '~/hooks/useTrans'
import { dsbKeys, dsbMutationKeys } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TDsbFieldMap, TDsb } from '~/spec'
import { writeDemoFields } from '~/stores/dsbShell/demoFields'
import type { TDsbShellStore } from '~/stores/dsbShell/spec'
import { toast } from '~/ui/Toaster'
import type { TDsbEditableFieldKey, TDsbFieldKey } from '~/unit/DsbThread/spec'

import type { TDsbConfirmedReader } from './dsb/types'

export type TDsbSaveExecution = {
  community: string
  demoMode: boolean
  dashboardStore: TDsbShellStore
  execute: (commandId: string) => Promise<unknown>
  field: TDsbFieldKey
  submitted: Partial<TDsbFieldMap>
  savedFields: readonly TDsbEditableFieldKey[]
  readConfirmed?: TDsbConfirmedReader
  afterConfirmed?: (data: unknown) => void
}

type TArgs = {
  community: string
}

/** Owns only transport lifecycle, confirmed Query update, and editor reconcile. */
export default function useDsbSaveRunner({ community }: TArgs) {
  const queryClient = useQueryClient()
  const { t } = useTrans()
  const mutationKey = dsbMutationKeys.save(community)

  const applyConfirmed = (
    request: TDsbSaveExecution,
    confirmed: Partial<TDsbFieldMap>,
    data: unknown,
  ): void => {
    if (!request.demoMode) {
      queryClient.setQueryData<TDsb>(dsbKeys.slug(request.community), (previous) =>
        previous ? { ...previous, ...confirmed } : previous,
      )
    }
    request.dashboardStore.reconcile({
      fields: request.savedFields,
      submitted: request.submitted,
      confirmed,
    })
    request.afterConfirmed?.(data)
  }

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

    if (!responseComplete) {
      void invalidate(queryClient, QueryInvalidation.community.dashboard(request.community))
    }

    applyConfirmed(request, confirmed, data)
  }

  const saveMutation = useMutation({
    mutationKey,
    mutationFn: async (request: TDsbSaveExecution) => {
      if (request.demoMode) {
        writeDemoFields(request.community, request.submitted)
        return null
      }

      return executeCommand<{ commandId: string }, unknown>({
        request: ({ commandId }) => request.execute(commandId),
        variables: {},
      })
    },
    onSuccess: (data, request) => {
      if (request.demoMode) {
        applyConfirmed(request, clone(request.submitted), null)
      } else {
        confirm(request, data)
      }
      toast(t('dsb.appearance.saved'))
    },
    onError: (error) => {
      console.error('## save dashboard field error: ', error)
      toast(String(error), 'error')
    },
  })

  return {
    save: saveMutation.mutate,
    isPending: useIsMutating({ mutationKey }) > 0,
    error:
      saveMutation.variables?.community === community ? (saveMutation.error as Error | null) : null,
  }
}
