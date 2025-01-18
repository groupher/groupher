'use client'

/*
 * make children compoent cound reach the props.theme object
 */
import type { FC, ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'

import usePrimaryColor from '~/hooks/usePrimaryColor'
import useThemeData from '~/hooks/useThemeData'

import GlobalStyle from './GlobalStyle'

type TProps = {
  children: ReactNode
}

const ThemePalette: FC<TProps> = ({ children }) => {
  const themeData = useThemeData()
  const primaryColor = usePrimaryColor()
  // see https://css-tricks.com/meta-theme-color-and-trickery/
  // theme seems conflict with manifest

  return (
    <ThemeProvider theme={themeData}>
      <GlobalStyle $color={primaryColor} />
      {children}
    </ThemeProvider>
  )
}

export default ThemePalette

// about meta theme-color
// see: https://stackoverflow.com/questions/26960703/how-to-change-the-color-of-header-bar-and-address-bar-in-newest-chrome-version-o
