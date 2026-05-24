import { clone } from 'ramda'
import { useEffect, useRef } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import useDsbDemoMode from '~/hooks/useDsbDemoMode'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { toast } from '~/signal'
import type { TResolvedThemePreset, TThemePreset, TThemePresetOption } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { buildDsbDemoConfig, setDsbDemoConfig } from '~/utils/dsb-demo'
import { revalidateCommunityCache } from '~/utils/revalidateCommunityCache'

import { FIELD } from '../../../constant'
import { THEME_PRESET_STORE_FIELDS } from '../constant'
import * as S from '../schema'
import type { TThemePresetMutationRet } from '../spec'

type TThemePresetMutationLayout = {
  themePreset: TThemePreset
  themePresetBase: TThemePreset
  themeTokens: TResolvedThemePreset
  themePresets: readonly TThemePresetOption[]
}

type TThemePresetMutationData = {
  saveCustomThemePreset?: {
    dashboard?: {
      layout?: TThemePresetMutationLayout
    }
  }
  selectThemePreset?: {
    dashboard?: {
      layout?: TThemePresetMutationLayout
    }
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
  const dashboard$ = useDashboard()
  const liveDashboard$ = dashboard$.live$ ?? dashboard$
  const { mutate } = useGraphQLClient()
  const isDemoMode = useDsbDemoMode()
  const storeRef = useRef(liveDashboard$)
  const { slug: community } = useCommunity()

  useEffect(() => {
    storeRef.current = liveDashboard$
  }, [liveDashboard$])

  const acceptThemePreset = (layout?: TThemePresetMutationLayout): void => {
    if (layout) {
      storeRef.current.commit({
        themePreset: layout.themePreset,
        themePresetBase: layout.themePresetBase,
        themeTokens: clone(layout.themeTokens),
        themePresets: clone(layout.themePresets),
      })
    } else if (storeRef.current.themePreset === THEME_PRESET.CUSTOM) {
      storeRef.current.commit({
        themePresets: [
          ...storeRef.current.themePresets.filter((preset) => preset.value !== THEME_PRESET.CUSTOM),
          {
            value: THEME_PRESET.CUSTOM,
            tokens: clone(storeRef.current.themeTokens) as TResolvedThemePreset,
          },
        ],
      })
    }

    storeRef.current.acceptFields(THEME_PRESET_STORE_FIELDS)

    const original = {
      ...storeRef.current.original,
      themePreset: storeRef.current.themePreset,
      themePresetBase: storeRef.current.themePresetBase,
      themePresets: clone(storeRef.current.themePresets),
      themeTokens: clone(storeRef.current.themeTokens),
      themeOverwrite: clone(storeRef.current.themeOverwrite),
    }

    storeRef.current.replaceOriginal(original)
  }

  const finishSave = async ({
    layout,
    revalidate = true,
  }: {
    layout?: TThemePresetMutationLayout
    revalidate?: boolean
  } = {}): Promise<void> => {
    toast('设置已保存')

    if (revalidate) {
      try {
        await revalidateCommunityCache(community)
      } catch (err) {
        console.error('## revalidate community cache error: ', err)
      }
    }

    acceptThemePreset(layout)
    setTimeout(() => storeRef.current.commit({ saving: false, savingField: null }), 800)
  }

  const saveThemePreset = (): void => {
    storeRef.current.commit({ saving: true, savingField: FIELD.THEME_PRESET })

    if (isDemoMode) {
      setDsbDemoConfig(buildDsbDemoConfig(storeRef.current))
      finishSave({ revalidate: false })
      return
    }

    // Only Custom saves sparse `themeOverwrite`; the backend merges it into
    // the dashboard's nullable Custom preset definition. Readonly presets are
    // saved by preset name and do not modify the saved Custom preset.
    const isCustomPreset = storeRef.current.themePreset === THEME_PRESET.CUSTOM
    const request = isCustomPreset
      ? mutate<TThemePresetMutationData>(S.saveCustomThemePreset, {
          community,
          themePreset: storeRef.current.themePreset,
          themePresetBase: storeRef.current.themePresetBase,
          themeOverwrite: JSON.stringify(storeRef.current.themeOverwrite ?? {}),
        })
      : mutate<TThemePresetMutationData>(S.selectThemePreset, {
          community,
          themePreset: storeRef.current.themePreset,
        })

    request
      .then((data) => {
        const layout =
          data.saveCustomThemePreset?.dashboard?.layout ?? data.selectThemePreset?.dashboard?.layout

        return finishSave({ layout })
      })
      .catch((err) => {
        console.error('## save theme preset error: ', err)
        toast(String(err), 'error')
        storeRef.current.commit({ saving: false, savingField: null })
      })
  }

  const rollbackThemePreset = (): void => {
    storeRef.current.rollbackFields(THEME_PRESET_STORE_FIELDS)
  }

  return { saveThemePreset, rollbackThemePreset }
}
