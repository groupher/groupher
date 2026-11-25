import {
  useIsMutating,
  useMutation as useTanStackMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { clone } from 'ramda'

import { DEFAULT_THEME_PRESET, THEME_PRESET } from '~/const/theme_preset'
import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { dsbKeys, dsbMutationKeys } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TDsb, TResolvedThemePreset, TThemePreset, TThemePresetOption } from '~/spec'
import type { TDsbFieldMap } from '~/spec'
import { writeDemoFields } from '~/stores/dsbShell/demoFields'
import { useDsbShellSession, useDsbShellStore } from '~/stores/dsbShell/hooks'
import type { TDsbShellStore } from '~/stores/dsbShell/spec'
import { toast } from '~/ui/Toaster'
import * as S from '~/unit/DsbThread/Appearance/Theme/schema'

import { THEME_PRESET_STORE_FIELDS } from '../constant'
import type { TThemePresetMutationRet } from '../spec'

type TThemePresetMutationLayout = {
  themePreset: TThemePreset
  themePresetBase: TThemePreset | null
  themeTokens: TResolvedThemePreset
  themePresets: readonly TThemePresetOption[]
}

type TThemePresetMutationData = {
  saveCustomThemePreset?: {
    layout?: TThemePresetMutationLayout
  }
  selectThemePreset?: {
    layout?: TThemePresetMutationLayout
  }
}

type TThemePresetSaveVariables = {
  community: string
  demoMode: boolean
  dashboardStore: TDsbShellStore
  isCustomPreset: boolean
  submitted: Partial<TDsbFieldMap>
}

/**
 * ThemePreset-specific mutation boundary.
 *
 * Intent: persist preset selection/custom tokens through the dedicated preset
 * API while keeping generic dashboard mutations unaware of preset fields.
 *
 * Example:
 *   const { saveThemePreset, rollbackThemePreset } = useThemePresetMutation()
 *   saveThemePreset()
 */
export default function useThemePresetMutation(): TThemePresetMutationRet {
  const dashboardStore = useDsbShellStore()
  const { t } = useTrans()
  const { community, demoMode } = useDsbShellSession()
  const queryClient = useQueryClient()
  const mutationKey = dsbMutationKeys.themeSave(community)

  const snapshot = (store: TDsbShellStore): Partial<TDsbFieldMap> => {
    const fields = {} as Partial<TDsbFieldMap>
    for (const field of THEME_PRESET_STORE_FIELDS) fields[field] = clone(store[field]) as never
    return fields
  }

  const themeMutation = useTanStackMutation({
    mutationKey,
    mutationFn: async ({
      community: targetCommunity,
      demoMode: requestDemoMode,
      dashboardStore: requestStore,
      isCustomPreset,
      submitted,
    }: TThemePresetSaveVariables) => {
      if (requestDemoMode) {
        writeDemoFields(targetCommunity, submitted)
        return {
          data: null,
          submitted,
          community: targetCommunity,
          demoMode: requestDemoMode,
          dashboardStore: requestStore,
        }
      }

      const data = isCustomPreset
        ? await executeCommand({
            request: (variables) =>
              browserGraphQLRequest<TThemePresetMutationData>(S.saveCustomThemePreset, variables),
            variables: {
              community: targetCommunity,
              themePreset: submitted.themePreset,
              themePresetBase: submitted.themePresetBase ?? DEFAULT_THEME_PRESET,
              themeOverwrite: JSON.stringify(submitted.themeOverwrite ?? {}),
            },
          })
        : await executeCommand({
            request: (variables) =>
              browserGraphQLRequest<TThemePresetMutationData>(S.selectThemePreset, variables),
            variables: {
              community: targetCommunity,
              themePreset: submitted.themePreset,
            },
          })
      return {
        data,
        submitted,
        community: targetCommunity,
        demoMode: requestDemoMode,
        dashboardStore: requestStore,
      }
    },
    onSuccess: ({
      data,
      submitted,
      community: targetCommunity,
      demoMode: requestDemoMode,
      dashboardStore: requestStore,
    }) => {
      const layout = data?.saveCustomThemePreset?.layout ?? data?.selectThemePreset?.layout
      const confirmed: Partial<TDsbFieldMap> =
        !requestDemoMode && layout
          ? {
              themePreset: layout.themePreset,
              themePresetBase: layout.themePresetBase ?? DEFAULT_THEME_PRESET,
              themeTokens: clone(layout.themeTokens),
              themePresets: clone(layout.themePresets),
              themeOverwrite: clone(submitted.themeOverwrite),
            }
          : submitted

      if (!requestDemoMode) {
        queryClient.setQueryData<TDsb>(dsbKeys.slug(targetCommunity), (previous) =>
          previous ? { ...previous, ...confirmed } : previous,
        )
      }
      requestStore.reconcile({
        fields: THEME_PRESET_STORE_FIELDS,
        submitted,
        confirmed,
      })
      if (!requestDemoMode && !layout) {
        void invalidate(queryClient, QueryInvalidation.community.dashboard(targetCommunity))
      }

      toast(t('dsb.appearance.saved'))
    },
    onError: (err) => {
      console.error('## save theme preset error: ', err)
      toast(String(err), 'error')
    },
  })

  const saveThemePreset = (): void => {
    // Only Custom saves sparse `themeOverwrite`; the backend merges it into
    // the dashboard's nullable Custom preset definition. Readonly presets are
    // saved by preset name and do not modify the saved Custom preset.
    const requestStore = dashboardStore
    themeMutation.mutate({
      community,
      demoMode,
      dashboardStore: requestStore,
      isCustomPreset: requestStore.themePreset === THEME_PRESET.CUSTOM,
      submitted: snapshot(requestStore),
    })
  }

  const rollbackThemePreset = (): void => {
    dashboardStore.rollback(THEME_PRESET_STORE_FIELDS)
  }

  return {
    saveThemePreset,
    rollbackThemePreset,
    isPending: useIsMutating({ mutationKey }) > 0,
    error:
      (themeMutation.variables as TThemePresetSaveVariables | undefined)?.community === community
        ? (themeMutation.error as Error | null)
        : null,
  }
}
