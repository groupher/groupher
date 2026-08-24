import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { RESOLVED_THEME_COOKIE, THEME_MODE, THEME_MODE_COOKIE } from '~/const/theme'
import THEME from '~/const/theme'
import type { TThemeMode, TThemeName } from '~/spec'

type TThemeSeed = { theme: TThemeName; themeMode: TThemeMode }

const readCookie = (header: string | null, name: string): string | null => {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return null
}

const resolveThemeSeed = (cookieHeader: string | null): TThemeSeed => {
  const mode = readCookie(cookieHeader, THEME_MODE_COOKIE)
  const resolved = readCookie(cookieHeader, RESOLVED_THEME_COOKIE)
  const themeMode =
    mode === THEME_MODE.LIGHT || mode === THEME_MODE.DARK || mode === THEME_MODE.SYSTEM
      ? mode
      : THEME_MODE.SYSTEM
  const theme =
    themeMode === THEME_MODE.DARK
      ? THEME.DARK
      : themeMode === THEME_MODE.LIGHT
        ? THEME.LIGHT
        : resolved === THEME.DARK
          ? THEME.DARK
          : THEME.LIGHT
  return { theme, themeMode }
}

export const loadThemeSeed = createServerFn({ method: 'GET', strict: false }).handler(() =>
  resolveThemeSeed(getRequest().headers.get('cookie')),
)
