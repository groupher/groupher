import { useMemo } from 'react'

import { COLOR, PAGE_BG_COLOR_HEX, PAGE_BG_DEFAULT } from '~/const/colors'
import THEME from '~/const/theme'
import { blurRGB } from '~/fmt'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import { getPageBgCustomColor } from '~/lib/color'
import useDashboard from '~/stores/dashboard/hooks'

type TRes = {
  background: string | null
  rawBg: string
}

export default function usePageBg(themeOverride?: string): TRes {
  const { isLightTheme } = useTheme()
  const {
    pageBg,
    pageBgDark,
    pageCustomBg,
    pageCustomBgDark,
    pageCustomIntensity,
    pageCustomIntensityDark,
  } = useDashboard()
  const gaussBlur = useGaussBlur()
  const theme = themeOverride || (isLightTheme ? THEME.LIGHT : THEME.DARK)
  const isLightBg = theme === THEME.LIGHT

  const rawBg = useMemo(() => {
    const currentPageBg = isLightBg ? pageBg : pageBgDark
    if (currentPageBg === COLOR.CUSTOM) {
      return isLightBg
        ? getPageBgCustomColor('light', pageCustomBg, pageCustomIntensity)
        : getPageBgCustomColor('dark', pageCustomBgDark, pageCustomIntensityDark)
    }

    const fallbackPageBg = PAGE_BG_DEFAULT[theme]
    return PAGE_BG_COLOR_HEX[currentPageBg] || PAGE_BG_COLOR_HEX[fallbackPageBg]
  }, [
    isLightBg,
    pageBg,
    pageBgDark,
    pageCustomBg,
    pageCustomBgDark,
    pageCustomIntensity,
    pageCustomIntensityDark,
    theme,
  ])

  const background = useMemo(() => {
    if (!rawBg) return null
    return blurRGB(rawBg, gaussBlur)
  }, [rawBg, gaussBlur])

  return { background, rawBg }
}
