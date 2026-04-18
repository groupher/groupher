'use client'

import { type CSSProperties, type FC, type ReactNode, useEffect } from 'react'
import { COLOR, getDefaultCustomColor } from '~/const/colors'
import THEME from '~/const/theme'
import { getPageBgCustomColor } from '~/lib/color'
import useDashboard from '~/stores/dashboard/hooks'

type TProps = {
  children: ReactNode
}

const DashboardThemeScope: FC<TProps> = ({ children }) => {
  const {
    primaryColor,
    pageBg,
    pageBgDark,
    pageCustomBg,
    pageCustomBgDark,
    pageCustomIntensity,
    pageCustomIntensityDark,
    primaryCustomColor,
    primaryCustomColorDark,
    subPrimaryCustomColor,
    subPrimaryCustomColorDark,
  } = useDashboard()
  const lightDefault = getDefaultCustomColor('light')
  const darkDefault = getDefaultCustomColor('dark')

  useEffect(() => {
    const root = document.documentElement
    const lightPageBg =
      pageBg === COLOR.CUSTOM
        ? getPageBgCustomColor(THEME.LIGHT, pageCustomBg, pageCustomIntensity)
        : 'transparent'
    const darkPageBg =
      pageBgDark === COLOR.CUSTOM
        ? getPageBgCustomColor(THEME.DARK, pageCustomBgDark, pageCustomIntensityDark)
        : 'transparent'

    root.style.setProperty('--color-primary-custom', primaryCustomColor || lightDefault)
    root.style.setProperty('--color-primary-custom-dark', primaryCustomColorDark || darkDefault)
    root.style.setProperty('--color-sub-primary-custom', subPrimaryCustomColor || lightDefault)
    root.style.setProperty(
      '--color-sub-primary-custom-dark',
      subPrimaryCustomColorDark || darkDefault,
    )
    root.style.setProperty('--color-page-custom-light', lightPageBg)
    root.style.setProperty('--color-page-custom-dark', darkPageBg)
  }, [
    darkDefault,
    lightDefault,
    pageBg,
    pageBgDark,
    pageCustomBg,
    pageCustomBgDark,
    pageCustomIntensity,
    pageCustomIntensityDark,
    primaryCustomColor,
    primaryCustomColorDark,
    subPrimaryCustomColor,
    subPrimaryCustomColorDark,
  ])

  const style = {
    '--color-page-custom-light':
      pageBg === COLOR.CUSTOM
        ? getPageBgCustomColor(THEME.LIGHT, pageCustomBg, pageCustomIntensity)
        : 'transparent',
    '--color-page-custom-dark':
      pageBgDark === COLOR.CUSTOM
        ? getPageBgCustomColor(THEME.DARK, pageCustomBgDark, pageCustomIntensityDark)
        : 'transparent',
    '--color-primary-custom': primaryCustomColor || lightDefault,
    '--color-primary-custom-dark': primaryCustomColorDark || darkDefault,
    '--color-sub-primary-custom': subPrimaryCustomColor || lightDefault,
    '--color-sub-primary-custom-dark': subPrimaryCustomColorDark || darkDefault,
  } as CSSProperties

  return (
    <div data-primary-color={primaryColor} style={style}>
      {children}
    </div>
  )
}

export default DashboardThemeScope
