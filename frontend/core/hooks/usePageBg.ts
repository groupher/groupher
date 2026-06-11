import { blurRGB } from '~/fmt'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import { THEME_PRESET_PAGE_BG_CSS_VAR } from '~/lib/themePreset'
import type { TResolvedThemePreset } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

type TRes = {
  background: string
  rawBg: string
}

export default function usePageBg(): TRes {
  const { theme } = useTheme()
  const { themeTokens } = useThemePreset()
  const gaussBlur = useGaussBlur()
  const tokens = themeTokens as Partial<TResolvedThemePreset>
  const rawBg = tokens[theme]?.pageBg || THEME_PRESET_PAGE_BG_CSS_VAR
  const background = blurRGB(rawBg, gaussBlur)

  return { background, rawBg }
}
