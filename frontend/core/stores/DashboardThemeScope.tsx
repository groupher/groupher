'use client'

import { type CSSProperties, type FC, type ReactNode, useEffect } from 'react'
import { getDefaultCustomColor } from '~/const/colors'
import useDashboard from '~/stores/dashboard/hooks'

type TProps = {
  children: ReactNode
}

const DashboardThemeScope: FC<TProps> = ({ children }) => {
  const {
    primaryColor,
    primaryCustomColor,
    primaryCustomColorDark,
    subPrimaryCustomColor,
    subPrimaryCustomColorDark,
  } = useDashboard()
  const lightDefault = getDefaultCustomColor('light')
  const darkDefault = getDefaultCustomColor('dark')

  useEffect(() => {
    const root = document.documentElement

    root.style.setProperty('--color-primary-custom', primaryCustomColor || lightDefault)
    root.style.setProperty('--color-primary-custom-dark', primaryCustomColorDark || darkDefault)
    root.style.setProperty('--color-sub-primary-custom', subPrimaryCustomColor || lightDefault)
    root.style.setProperty(
      '--color-sub-primary-custom-dark',
      subPrimaryCustomColorDark || darkDefault,
    )
  }, [
    darkDefault,
    lightDefault,
    primaryCustomColor,
    primaryCustomColorDark,
    subPrimaryCustomColor,
    subPrimaryCustomColorDark,
  ])

  const style = {
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
