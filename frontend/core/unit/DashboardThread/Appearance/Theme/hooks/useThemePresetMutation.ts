import { clone } from 'ramda'
import { useEffect, useRef } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import useDsbDemoMode from '~/hooks/useDsbDemoMode'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { toast } from '~/signal'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { buildDsbDemoConfig, setDsbDemoConfig } from '~/utils/dsb-demo'
import { revalidateCommunityCache } from '~/utils/revalidateCommunityCache'

import { FIELD } from '../../../constant'
import { THEME_PRESET_STORE_FIELDS } from '../constant'
import * as S from '../schema'
import type { TThemePresetMutationRet } from '../spec'

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

  const acceptThemePreset = (): void => {
    const hasCustomThemePreset =
      storeRef.current.hasCustomThemePreset || storeRef.current.themePreset === THEME_PRESET.CUSTOM

    storeRef.current.commit({ hasCustomThemePreset })
    storeRef.current.acceptFields(THEME_PRESET_STORE_FIELDS)

    const original = {
      ...storeRef.current.original,
      hasCustomThemePreset,
      themeTokens: clone(storeRef.current.themeTokens),
    }

    storeRef.current.replaceOriginal(original)
  }

  const finishSave = async ({ revalidate = true } = {}): Promise<void> => {
    toast('设置已保存')

    if (revalidate) {
      try {
        await revalidateCommunityCache(community)
      } catch (err) {
        console.error('## revalidate community cache error: ', err)
      }
    }

    acceptThemePreset()
    setTimeout(() => storeRef.current.commit({ saving: false, savingField: null }), 800)
  }

  const saveThemePreset = (): void => {
    storeRef.current.commit({ saving: true, savingField: FIELD.THEME_PRESET })

    if (isDemoMode) {
      setDsbDemoConfig(buildDsbDemoConfig(storeRef.current))
      finishSave({ revalidate: false })
      return
    }

    const isCustomPreset = storeRef.current.themePreset === THEME_PRESET.CUSTOM
    const request = isCustomPreset
      ? mutate(S.saveCustomThemePreset, {
          community,
          themePreset: storeRef.current.themePreset,
          themePresetBase: storeRef.current.themePresetBase,
          themeTokens: JSON.stringify(storeRef.current.themeTokens ?? {}),
        })
      : mutate(S.selectThemePreset, {
          community,
          themePreset: storeRef.current.themePreset,
        })

    request.then(finishSave).catch((err) => {
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
