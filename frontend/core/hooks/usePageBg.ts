import { useMemo } from 'react'

import THEME from '~/const/theme'
import { blurRGB } from '~/fmt'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/stores/ThemePreset/hooks'

type TRes = {
  background: string | null
  rawBg: string
}

type TThemeName = typeof THEME.LIGHT | typeof THEME.DARK

export default function usePageBg(themeOverride?: TThemeName): TRes {
  const { isLightTheme } = useTheme()
  const { pageBg, pageBgDark } = useThemePreset()
  const gaussBlur = useGaussBlur()
  const theme = themeOverride || (isLightTheme ? THEME.LIGHT : THEME.DARK)
  const isLightBg = theme === THEME.LIGHT

  const rawBg = useMemo(() => {
    return isLightBg ? pageBg : pageBgDark
  }, [isLightBg, pageBg, pageBgDark])

  const background = useMemo(() => {
    if (!rawBg) return null
    return blurRGB(rawBg, gaussBlur)
  }, [rawBg, gaussBlur])

  return { background, rawBg }
}
