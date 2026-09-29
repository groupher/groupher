import { useMutation as useTanStackMutation, useQueryClient } from '@tanstack/react-query'
import { clone } from 'ramda'
import { useRef } from 'react'

import { DEFAULT_THEME_PRESET, THEME_PRESET } from '~/const/theme_preset'
import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { dsbKeys } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import type {
  TParseDashboard,
  TResolvedThemePreset,
  TThemePreset,
  TThemePresetOption,
} from '~/spec'
import type { TDsbFieldMap } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import { useDsbEditStore } from '~/stores/dsbEdit/hooks'
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
  const dashboardStore = useDsbEditStore()
  const { t } = useTrans()
  const storeRef = useRef(dashboardStore)
  const { slug: community } = useCommunity()
  const queryClient = useQueryClient()

  const snapshot = (): Partial<TDsbFieldMap> => {
    const current = storeRef.current
    const fields = {} as Partial<TDsbFieldMap>
    for (const field of THEME_PRESET_STORE_FIELDS) fields[field] = clone(current[field]) as never
    return fields
  }

  const themeMutation = useTanStackMutation({
    mutationKey: ['dsb', 'theme-save', community],
    mutationFn: async ({
      isCustomPreset,
      submitted,
    }: {
      isCustomPreset: boolean
      submitted: Partial<TDsbFieldMap>
    }) => {
      const data = isCustomPreset
        ? await browserGraphQLRequest<TThemePresetMutationData>(S.saveCustomThemePreset, {
            community,
            themePreset: submitted.themePreset,
            themePresetBase: submitted.themePresetBase ?? DEFAULT_THEME_PRESET,
            themeOverwrite: JSON.stringify(submitted.themeOverwrite ?? {}),
          })
        : await browserGraphQLRequest<TThemePresetMutationData>(S.selectThemePreset, {
            community,
            themePreset: submitted.themePreset,
          })
      return { data, submitted }
    },
    onSuccess: ({ data, submitted }) => {
      const layout = data.saveCustomThemePreset?.layout ?? data.selectThemePreset?.layout
      const confirmed: Partial<TDsbFieldMap> = layout
        ? {
            themePreset: layout.themePreset,
            themePresetBase: layout.themePresetBase ?? DEFAULT_THEME_PRESET,
            themeTokens: clone(layout.themeTokens),
            themePresets: clone(layout.themePresets),
            themeOverwrite: clone(submitted.themeOverwrite),
          }
        : submitted

      queryClient.setQueryData<TParseDashboard>(dsbKeys.config(community), (previous) =>
        previous ? { ...previous, ...confirmed } : previous,
      )
      storeRef.current.reconcile({
        fields: THEME_PRESET_STORE_FIELDS,
        submitted,
        confirmed,
      })
      if (!layout) {
        void invalidate(queryClient, QueryInvalidation.community.dashboard(community))
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
    themeMutation.mutate({
      isCustomPreset: storeRef.current.themePreset === THEME_PRESET.CUSTOM,
      submitted: snapshot(),
    })
  }

  const rollbackThemePreset = (): void => {
    storeRef.current.rollback(THEME_PRESET_STORE_FIELDS)
  }

  return {
    saveThemePreset,
    rollbackThemePreset,
    isPending: themeMutation.isPending,
    error: themeMutation.error as Error | null,
  }
}
