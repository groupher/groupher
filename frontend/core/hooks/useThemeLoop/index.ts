'use client'

import { useCallback, useRef } from 'react'
import THEME, { THEME_MODE } from '~/const/theme'
import type { TThemeMode } from '~/spec'
import useThemeDomain from '~/stores/theme/hooks'

export default () => {
  const { theme, themeMode } = useThemeDomain()

  const loopRef = useRef<TThemeMode[]>([])

  if (loopRef.current.length === 0) {
    if (themeMode === THEME_MODE.LIGHT) {
      loopRef.current = [THEME_MODE.LIGHT, THEME_MODE.DARK, THEME_MODE.SYSTEM]
    } else if (themeMode === THEME_MODE.DARK) {
      loopRef.current = [THEME_MODE.DARK, THEME_MODE.LIGHT, THEME_MODE.SYSTEM]
    } else {
      if (theme === THEME.DARK) {
        loopRef.current = [THEME_MODE.SYSTEM, THEME_MODE.LIGHT, THEME_MODE.DARK]
      } else {
        loopRef.current = [THEME_MODE.SYSTEM, THEME_MODE.DARK, THEME_MODE.LIGHT]
      }
    }
  }

  const getNextThemeMode = useCallback((): TThemeMode => {
    const loop = loopRef.current
    const currentIndex = loop.indexOf(themeMode)

    if (currentIndex === -1) return THEME_MODE.SYSTEM

    const nextIndex = (currentIndex + 1) % loop.length
    return loop[nextIndex]
  }, [themeMode])

  const getAriaLabel = useCallback(() => {
    return `${themeMode} mode`
  }, [themeMode])

  return {
    getNextThemeMode,
    getAriaLabel,
  }
}
