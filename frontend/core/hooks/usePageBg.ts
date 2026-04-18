import { useMemo } from 'react'
import { PAGE_BG_CSS_KEY } from '~/const/colors'
import { blurRGB } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
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
  const rawBg = useCSSVar(
    PAGE_BG_CSS_KEY,
    [
      pageBg,
      pageBgDark,
      pageCustomBg,
      pageCustomBgDark,
      pageCustomIntensity,
      pageCustomIntensityDark,
      gaussBlur,
      isLightTheme,
    ],
    { selector: 'main' },
  )

  const background = useMemo(() => {
    if (!rawBg) return null
    return blurRGB(rawBg, gaussBlur)
  }, [rawBg, gaussBlur])

  return { background, rawBg }
}
