'use client'

import { useEffect, useRef } from 'react'

import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import useMount from '~/hooks/useMount'
import useTheme from '~/hooks/useTheme'
import { resolveRuntimeTheme } from '~/lib/themeRuntime'
import type { TThemeMode, TThemeName } from '~/spec'
import {
  removeThemeFirstPaintVars,
  scheduleRemoveThemeFirstPaintVars,
} from '~/utils/themeFirstPaint'

export default function ThemeMonitor() {
  const { theme, changeMode } = useTheme()
  const cleanupRef = useRef<(() => void) | null>(null)
  const pendingRuntimeThemeRef = useRef<TThemeName | null>(null)
  const themeRef = useRef<TThemeName>(theme)

  const cancelCleanup = () => {
    cleanupRef.current?.()
    cleanupRef.current = null
  }

  const scheduleCleanup = () => {
    cancelCleanup()
    cleanupRef.current = scheduleRemoveThemeFirstPaintVars()
  }

  const disposeCleanup = () => {
    cancelCleanup()
    removeThemeFirstPaintVars()
  }

  useEffect(() => {
    themeRef.current = theme

    if (pendingRuntimeThemeRef.current !== theme) return

    pendingRuntimeThemeRef.current = null
    scheduleCleanup()
  })

  useMount(() => {
    const applyMode = (mode: TThemeMode) => {
      const runtimeTheme = resolveRuntimeTheme(mode)

      pendingRuntimeThemeRef.current = runtimeTheme
      changeMode(mode, { keepFirstPaintVars: true })

      if (themeRef.current === runtimeTheme) {
        pendingRuntimeThemeRef.current = null
        scheduleCleanup()
      }
    }

    try {
      const seededMode = document.documentElement.dataset.themeMode
      const usesCookieTheme = seededMode !== undefined
      const stored = seededMode || localStorage.getItem(LOCAL_THEME_KEY)
      const isValid =
        stored === THEME.DARK || stored === THEME.LIGHT || stored === THEME_MODE.SYSTEM

      const mode = isValid ? stored : THEME_MODE.SYSTEM

      applyMode(mode)

      if (mode === THEME_MODE.SYSTEM) {
        const media = window.matchMedia('(prefers-color-scheme: dark)')

        const listener = () => {
          const currentMode = usesCookieTheme
            ? document.documentElement.dataset.themeMode
            : localStorage.getItem(LOCAL_THEME_KEY)

          if (currentMode === THEME_MODE.SYSTEM) {
            applyMode(THEME_MODE.SYSTEM)
          }
        }

        media.addEventListener('change', listener)

        return () => {
          disposeCleanup()
          media.removeEventListener('change', listener)
        }
      }
    } catch {
      applyMode(THEME_MODE.SYSTEM)
    }

    return () => {
      disposeCleanup()
    }
  })

  return null
}
