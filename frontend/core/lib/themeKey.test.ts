import THEME from '~/const/theme'

import { createThemeKeyPicker } from './themeKey'

describe('createThemeKeyPicker', () => {
  it('keeps base keys for light theme', () => {
    const themeKey = createThemeKeyPicker(THEME.LIGHT)
    const source = {
      pageBg: '#ffffff',
      pageBgDark: '#111111',
    }

    expect(themeKey.key('pageBg')).toBe('pageBg')
    expect(themeKey.value(source, 'pageBg')).toBe('#ffffff')
  })

  it('uses xxDark keys for dark theme', () => {
    const themeKey = createThemeKeyPicker(THEME.DARK)
    const source = {
      pageBg: '#ffffff',
      pageBgDark: '#111111',
    }

    expect(themeKey.key('pageBg')).toBe('pageBgDark')
    expect(themeKey.value(source, 'pageBg')).toBe('#111111')
  })
})
