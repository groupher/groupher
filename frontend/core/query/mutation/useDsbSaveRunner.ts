'use client'

import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { clone } from 'ramda'

import useTrans from '~/hooks/useTrans'
import { dsbKeys, dsbMutationKeys } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TDsbFieldMap, TDsb } from '~/spec'
import { writeDemoFields } from '~/stores/dsbShell/demoFields'
import { useDsbShellSession } from '~/stores/dsbShell/hooks'
import type { TDsbShellStore } from '~/stores/dsbShell/spec'
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
  dashboardStore: TDsbShellStore
}

/** Owns only transport lifecycle, confirmed Query update, and editor reconcile. */
export default function useDsbSaveRunner({ community, dashboardStore }: TArgs) {
  const queryClient = useQueryClient()
  const { t } = useTrans()
  const { demoMode } = useDsbShellSession()
  const mutationKey = dsbMutationKeys.save(community)

  const applyConfirmed = (request: TDsbSaveExecution, confirmed: Partial<TDsbFieldMap>): void => {
    queryClient.setQueryData<TDsb>(dsbKeys.slug(community), (previous) =>
      previous ? { ...previous, ...confirmed } : previous,
    )
    dashboardStore.reconcile({
      fields: request.savedFields,
      submitted: request.submitted,
      confirmed,
    })
    request.afterConfirmed?.(undefined)
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
      void invalidate(queryClient, QueryInvalidation.community.dashboard(community))
    }

    applyConfirmed(request, confirmed)
  }

  const saveMutation = useMutation({
    mutationKey,
    mutationFn: async (request: TDsbSaveExecution) => {
      if (demoMode) {
        writeDemoFields(community, request.submitted)
        return null
      }

      return executeCommand<{ commandId: string }, unknown>({
        request: ({ commandId }) => request.execute(commandId),
        variables: {},
      })
    },
    onSuccess: (data, request) => {
      if (demoMode) {
        applyConfirmed(request, clone(request.submitted))
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
    isPending: useIsMutating({ mutationKey: dsbMutationKeys.save() }) > 0,
    error: saveMutation.error as Error | null,
  }
}
