import { useMemo } from 'react'

import { resolveThemePreset } from '~/lib/themePreset'
import useDashboard from '~/stores/dashboard/hooks'

export default function useThemePreset() {
  const dsb$ = useDashboard()

  return useMemo(
    () =>
      resolveThemePreset({
        themePreset: dsb$.themePreset,
        themeOverrides: dsb$.themeOverrides,
        pageBg: dsb$.pageBg,
        pageBgDark: dsb$.pageBgDark,
        pageCustomBg: dsb$.pageCustomBg,
        pageCustomBgDark: dsb$.pageCustomBgDark,
        pageCustomIntensity: dsb$.pageCustomIntensity,
        pageCustomIntensityDark: dsb$.pageCustomIntensityDark,
        primaryColor: dsb$.primaryColor,
        primaryCustomColor: dsb$.primaryCustomColor,
        primaryCustomColorDark: dsb$.primaryCustomColorDark,
        subPrimaryColor: dsb$.subPrimaryColor,
        textTitle: dsb$.textTitle,
        textDigest: dsb$.textDigest,
      }),
    [
      dsb$.themePreset,
      dsb$.themeOverrides,
      dsb$.pageBg,
      dsb$.pageBgDark,
      dsb$.pageCustomBg,
      dsb$.pageCustomBgDark,
      dsb$.pageCustomIntensity,
      dsb$.pageCustomIntensityDark,
      dsb$.primaryColor,
      dsb$.primaryCustomColor,
      dsb$.primaryCustomColorDark,
      dsb$.subPrimaryColor,
      dsb$.textTitle,
      dsb$.textDigest,
    ],
  )
}
