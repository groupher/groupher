import THEME from '~/const/theme'
import { blurRGB } from '~/fmt'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import { getThemePresetPageBgCssVar } from '~/lib/themePreset'
import useThemePreset from '~/stores/ThemePreset/hooks'

type TRes = {
  background: string
  rawBg: string
}

type TThemeName = typeof THEME.LIGHT | typeof THEME.DARK

export default function usePageBg(themeOverride?: TThemeName): TRes {
  const { isLightTheme } = useTheme()
  const { pageBg, pageBgDark } = useThemePreset()
  const gaussBlur = useGaussBlur()
  const theme = themeOverride || (isLightTheme ? THEME.LIGHT : THEME.DARK)
  const isLightBg = theme === THEME.LIGHT
  const rawBg = (isLightBg ? pageBg : pageBgDark) || getThemePresetPageBgCssVar(theme)
  const background = blurRGB(rawBg, gaussBlur)

  return { background, rawBg }
}
