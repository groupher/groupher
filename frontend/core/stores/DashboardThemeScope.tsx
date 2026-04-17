'use client'

import { useEffect, type CSSProperties, type FC, type ReactNode } from 'react'
import { getDefaultCustomColor } from '~/const/colors'
import useDashboard from '~/stores/dashboard/hooks'

type TProps = {
  children: ReactNode
}

const DashboardThemeScope: FC<TProps> = ({ children }) => {
  const { primaryColor, primaryCustomColor, primaryCustomColorDark } = useDashboard()
  const lightDefault = getDefaultCustomColor('light')
  const darkDefault = getDefaultCustomColor('dark')

  useEffect(() => {
    const root = document.documentElement

    root.style.setProperty('--color-primary-custom', primaryCustomColor || lightDefault)
    root.style.setProperty('--color-primary-custom-dark', primaryCustomColorDark || darkDefault)
  }, [darkDefault, lightDefault, primaryCustomColor, primaryCustomColorDark])

  const style = {
    '--color-primary-custom': primaryCustomColor || lightDefault,
    '--color-primary-custom-dark': primaryCustomColorDark || darkDefault,
  } as CSSProperties

  return (
    <div data-primary-color={primaryColor} style={style}>
      {children}
    </div>
  )
}

export default DashboardThemeScope
