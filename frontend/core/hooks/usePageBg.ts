import { useMemo } from 'react'
import { COLOR, PAGE_BG_COLOR_HEX } from '~/const/colors'
import { blurRGB } from '~/fmt'
import { getPageBgCustomColor } from '~/lib/color'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import useDashboard from '~/stores/dashboard/hooks'

type TRes = {
  background: string
  rawBg: string
}

export default function usePageBg(): TRes {
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
  const rawBg = useMemo(() => {
    const currentPageBg = isLightTheme ? pageBg : pageBgDark
    if (currentPageBg === COLOR.CUSTOM) {
      return isLightTheme
        ? getPageBgCustomColor('light', pageCustomBg, pageCustomIntensity)
        : getPageBgCustomColor('dark', pageCustomBgDark, pageCustomIntensityDark)
    }

    return PAGE_BG_COLOR_HEX[currentPageBg] || ''
  }, [
    isLightTheme,
    pageBg,
    pageBgDark,
    pageCustomBg,
    pageCustomBgDark,
    pageCustomIntensity,
    pageCustomIntensityDark,
  ])

  const background = useMemo(() => {
    if (!rawBg) return null
    return blurRGB(rawBg, gaussBlur)
  }, [rawBg, gaussBlur])

  return { background, rawBg }
}
