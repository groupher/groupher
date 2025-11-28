'use client'

import { useEffect } from 'react'
import THEME, { LOCAL_THEME_KEY } from '~/const/theme'
import useTheme from '~/hooks/useTheme'

export default function ThemeHydrator() {
  const { change } = useTheme()

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_THEME_KEY)

      if (stored === THEME.DARK || stored === THEME.LIGHT) {
        change(stored)
        document.documentElement.setAttribute('data-theme', stored)
      } else {
        const media = window.matchMedia('(prefers-color-scheme: dark)')

        const applyTheme = (matches: boolean) => {
          const systemTheme = matches ? THEME.DARK : THEME.LIGHT
          change(THEME.SYSTEM)
          document.documentElement.setAttribute('data-theme', systemTheme)
        }

        applyTheme(media.matches)

        const listener = (e: MediaQueryListEvent) => {
          applyTheme(e.matches)
        }

        media.addEventListener('change', listener)
        return () => media.removeEventListener('change', listener)
      }
    } catch {}
  }, [change])

  return null
}
