import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { RESOLVED_THEME_COOKIE, THEME_MODE, THEME_MODE_COOKIE } from '~/const/theme'
import THEME from '~/const/theme'
import type { TThemeMode, TThemeName } from '~/spec'

import { setPrivateCacheHeader } from './graphql'

export type TThemeSeed = {
  theme: TThemeName
  themeMode: TThemeMode
}

const readCookie = (header: string | null, name: string): string | null => {
  if (!header) return null

  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key !== name) continue

    const raw = value.join('=')
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }

  return null
}

const isThemeMode = (value: string | null): value is TThemeMode =>
  value === THEME_MODE.LIGHT || value === THEME_MODE.DARK || value === THEME_MODE.SYSTEM

const isThemeName = (value: string | null): value is TThemeName =>
  value === THEME.LIGHT || value === THEME.DARK

export const resolveThemeSeed = (cookieHeader: string | null): TThemeSeed => {
  const cookieMode = readCookie(cookieHeader, THEME_MODE_COOKIE)
  const cookieResolvedTheme = readCookie(cookieHeader, RESOLVED_THEME_COOKIE)
  const themeMode = isThemeMode(cookieMode) ? cookieMode : THEME_MODE.SYSTEM

  if (themeMode === THEME_MODE.LIGHT) {
    return { theme: THEME.LIGHT, themeMode }
  }

  if (themeMode === THEME_MODE.DARK) {
    return { theme: THEME.DARK, themeMode }
  }

  return {
    theme: isThemeName(cookieResolvedTheme) ? cookieResolvedTheme : THEME.LIGHT,
    themeMode,
  }
}

export const loadThemeSeed = createServerFn({ method: 'GET', strict: false }).handler(
  (): TThemeSeed => {
    setPrivateCacheHeader()
    return resolveThemeSeed(getRequest().headers.get('cookie'))
  },
)
