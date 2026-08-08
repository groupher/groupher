import { beforeEach, describe, expect, it, vi } from 'vitest'

import THEME, { THEME_MODE } from '~/const/theme'

import { prePaintRuntimeSeedScript, prePaintThemeDetectScript } from './first-paint'

describe('prePaintThemeDetectScript', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme-mode')
    document.documentElement.removeAttribute('style')
  })

  it('keeps an explicit dark theme before hydration', () => {
    window.eval(
      prePaintThemeDetectScript({
        theme: THEME.DARK,
        themeMode: THEME_MODE.DARK,
      }),
    )

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.themeMode).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.cookie).toContain('themeMode=dark')
    expect(document.cookie).toContain('resolvedTheme=dark')
  })

  it('resolves system mode with matchMedia before hydration', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
      }),
    )

    window.eval(
      prePaintThemeDetectScript({
        theme: THEME.LIGHT,
        themeMode: THEME_MODE.SYSTEM,
      }),
    )

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.themeMode).toBe('system')
    expect(document.cookie).toContain('resolvedTheme=dark')
  })
})

describe('prePaintRuntimeSeedScript', () => {
  it('uses the server-rendered timestamp as the hydration baseline', () => {
    window.eval(prePaintRuntimeSeedScript(123_456))

    expect(
      (window as Window & { __GROUPHER_INITIAL_NOW__?: number }).__GROUPHER_INITIAL_NOW__,
    ).toBe(123_456)
  })
})
