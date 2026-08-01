'use client'

import { useEffect, useRef } from 'react'

import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import useMount from '~/hooks/useMount'
import useTheme from '~/hooks/useTheme'
import type { TThemeMode, TThemeName } from '~/spec'
import { scheduleRemoveThemeFirstPaintVars } from '~/utils/themeFirstPaint'

const resolveRuntimeTheme = (mode: TThemeMode): TThemeName => {
  if (mode === THEME_MODE.LIGHT) return THEME.LIGHT
  if (mode === THEME_MODE.DARK) return THEME.DARK

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return isDark ? THEME.DARK : THEME.LIGHT
}

export default function ThemeMonitor() {
  const { theme, changeMode } = useTheme()
  const cleanupRef = useRef<(() => void) | null>(null)
  const pendingRuntimeThemeRef = useRef<TThemeName | null>(null)

  const scheduleCleanup = () => {
    cleanupRef.current?.()
    cleanupRef.current = scheduleRemoveThemeFirstPaintVars()
  }

  useEffect(() => {
    if (pendingRuntimeThemeRef.current !== theme) return

    pendingRuntimeThemeRef.current = null
    scheduleCleanup()
  })

  useMount(() => {
    const applyMode = (mode: TThemeMode) => {
      const runtimeTheme = resolveRuntimeTheme(mode)

      pendingRuntimeThemeRef.current = runtimeTheme
      changeMode(mode, { keepFirstPaintVars: true })

      if (theme === runtimeTheme) {
        pendingRuntimeThemeRef.current = null
        scheduleCleanup()
      }
    }

    try {
      const stored = localStorage.getItem(LOCAL_THEME_KEY)
      const isValid =
        stored === THEME.DARK || stored === THEME.LIGHT || stored === THEME_MODE.SYSTEM

      const mode = isValid ? stored : THEME_MODE.SYSTEM

      applyMode(mode)

      if (mode === THEME_MODE.SYSTEM) {
        const media = window.matchMedia('(prefers-color-scheme: dark)')

        const listener = () => {
          if (localStorage.getItem(LOCAL_THEME_KEY) === THEME_MODE.SYSTEM) {
            applyMode(THEME_MODE.SYSTEM)
          }
        }

        media.addEventListener('change', listener)

        return () => {
          cleanupRef.current?.()
          media.removeEventListener('change', listener)
        }
      }
    } catch {
      applyMode(THEME_MODE.SYSTEM)
    }

    return () => {
      cleanupRef.current?.()
    }
  })

  return null
}
