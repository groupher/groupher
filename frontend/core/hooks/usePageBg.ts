import THEME from '~/const/theme'
import { blurRGB } from '~/fmt'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import { getThemePresetPageBgCssVar, getThemePresetSection } from '~/lib/themePreset'
import type { TResolvedThemePreset } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

type TRes = {
  background: string
  rawBg: string
}

type TThemeName = typeof THEME.LIGHT | typeof THEME.DARK

export default function usePageBg(themeOverride?: TThemeName): TRes {
  const { isLightTheme } = useTheme()
  const { themeTokens } = useThemePreset()
  const gaussBlur = useGaussBlur()
  const theme = themeOverride || (isLightTheme ? THEME.LIGHT : THEME.DARK)
  const tokens = themeTokens as TResolvedThemePreset
  const rawBg =
    tokens.light && tokens.dark
      ? getThemePresetSection(tokens, theme).pageBg || getThemePresetPageBgCssVar(theme)
      : getThemePresetPageBgCssVar(theme)
  const background = blurRGB(rawBg, gaussBlur)

  return { background, rawBg }
}
