'use client'

import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import useMount from '~/hooks/useMount'
import useTheme from '~/hooks/useTheme'

export default function ThemeMonitor() {
  const { changeMode } = useTheme()

  useMount(() => {
    try {
      const stored = localStorage.getItem(LOCAL_THEME_KEY)
      const isValid =
        stored === THEME.DARK || stored === THEME.LIGHT || stored === THEME_MODE.SYSTEM

      const mode = isValid ? stored : THEME_MODE.SYSTEM

      changeMode(mode)

      if (mode === THEME_MODE.SYSTEM) {
        const media = window.matchMedia('(prefers-color-scheme: dark)')

        const listener = () => {
          if (localStorage.getItem(LOCAL_THEME_KEY) === THEME_MODE.SYSTEM) {
            changeMode(THEME_MODE.SYSTEM)
          }
        }

        media.addEventListener('change', listener)

        return () => {
          media.removeEventListener('change', listener)
        }
      }
    } catch {
      changeMode(THEME_MODE.SYSTEM)
    }
  })

  return null
}
