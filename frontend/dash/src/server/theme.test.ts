import { describe, expect, it } from 'vitest'

import { resolveThemeSeed } from './theme'

describe('resolveThemeSeed', () => {
  it('defaults to system mode with a light server fallback', () => {
    expect(resolveThemeSeed(null)).toEqual({
      theme: 'light',
      themeMode: 'system',
    })
  })

  it('uses explicit theme modes without consulting the resolved cookie', () => {
    expect(resolveThemeSeed('themeMode=dark; resolvedTheme=light')).toEqual({
      theme: 'dark',
      themeMode: 'dark',
    })
  })

  it('uses the remembered resolved theme for system mode', () => {
    expect(resolveThemeSeed('themeMode=system; resolvedTheme=dark')).toEqual({
      theme: 'dark',
      themeMode: 'system',
    })
  })
})
