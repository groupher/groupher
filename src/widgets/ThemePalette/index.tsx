'use client'

/*
 * make children compoent cound reach the props.theme object
 */
import type { FC, ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'

import useThemeData from '~/hooks/useThemeData'

type TProps = {
  children: ReactNode
}

const ThemePalette: FC<TProps> = ({ children }) => {
  const themeData = useThemeData()
  // see https://css-tricks.com/meta-theme-color-and-trickery/
  // theme seems conflict with manifest

  return (
    <ThemeProvider theme={themeData}>
      {/* <GlobalStyle */}
      {children}
    </ThemeProvider>
  )
}

export default ThemePalette

// about meta theme-color
// see: https://stackoverflow.com/questions/26960703/how-to-change-the-color-of-header-bar-and-address-bar-in-newest-chrome-version-o
