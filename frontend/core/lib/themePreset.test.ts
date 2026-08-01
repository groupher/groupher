import type { TResolvedThemePreset } from '~/spec'

import {
  composeThemePresetCssVars,
  serializeCommunityThemePresetCss,
  THEME_PRESET_PAGE_BG_CSS_VAR,
} from './themePreset'

const tokens: TResolvedThemePreset = {
  shared: { glowFixed: true },
  light: {
    pageBg: '#ffffff',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#112233',
    accentColor: '#334455',
    textTitle: '#111111',
    textDigest: '#666666',
    cardColor: '#ffffff',
    dividerColor: '#dddddd',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
  dark: {
    pageBg: '#101010',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#223344',
    accentColor: '#445566',
    textTitle: '#eeeeee',
    textDigest: '#aaaaaa',
    cardColor: '#202020',
    dividerColor: '#333333',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
}

describe('THEME_PRESET_PAGE_BG_CSS_VAR', () => {
  it('holds the active page background css variable fallback', () => {
    expect(THEME_PRESET_PAGE_BG_CSS_VAR).toBe('var(--color-page-custom)')
  })
})

describe('composeThemePresetCssVars', () => {
  it('builds css variables from backend resolved tokens for the requested theme', () => {
    const lightVars = composeThemePresetCssVars(tokens, 'light')
    const darkVars = composeThemePresetCssVars(tokens, 'dark')

    expect(lightVars['--color-title']).toBe('#111111')
    expect(darkVars['--color-title']).toBe('#eeeeee')
    expect(darkVars['--color-card']).toBe('#202020')
    expect(lightVars['--color-page-custom']).toBe('#ffffff')
    expect(lightVars['--color-page-custom-bg']).toBe('#ffffff')
    expect(darkVars['--color-page-custom']).toBe('#101010')
    expect(darkVars['--color-page-custom-bg']).toBe('#101010')

    for (const key of [
      '--color-primary-custom-dark',
      '--color-accent-custom-dark',
      '--color-page-custom-dark',
      '--color-page-custom-bg-dark',
      '--color-title-dark',
      '--color-digest-dark',
      '--color-card-dark',
      '--color-divider-dark',
    ]) {
      expect(darkVars).not.toHaveProperty(key)
    }
  })

  it('builds final page background css with gauss blur applied', () => {
    const lightVars = composeThemePresetCssVars(
      {
        ...tokens,
        light: { ...tokens.light, gaussBlur: 45 },
      },
      'light',
    )

    expect(lightVars['--color-page-custom']).toBe('#ffffff')
    expect(lightVars['--color-page-custom-bg']).toBe('color-mix(in srgb, #ffffff 45%, transparent)')
  })

  it('keeps zero gauss blur as the solid page background', () => {
    const lightVars = composeThemePresetCssVars(
      {
        ...tokens,
        light: { ...tokens.light, gaussBlur: 0 },
      },
      'light',
    )

    expect(lightVars['--color-page-custom-bg']).toBe('#ffffff')
  })
})

describe('serializeCommunityThemePresetCss', () => {
  it('serializes community theme preset vars for both themes', () => {
    const styleText = serializeCommunityThemePresetCss(tokens)

    expect(styleText).toContain('--color-primary-custom: #112233;')
    expect(styleText).toContain('--color-primary-custom: #223344;')
    expect(styleText).toContain('--color-accent-custom: #334455;')
    expect(styleText).toContain('--color-accent-custom: #445566;')
    expect(styleText).toContain('--color-page-custom: #ffffff;')
    expect(styleText).toContain('--color-page-custom: #101010;')
    expect(styleText).toContain('--color-page-custom-bg: #ffffff;')
    expect(styleText).toContain('--color-page-custom-bg: #101010;')
    expect(styleText).toContain('--color-title: #111111;')
    expect(styleText).toContain('--color-title: #eeeeee;')
    expect(styleText).toContain('--color-digest: #666666;')
    expect(styleText).toContain('--color-digest: #aaaaaa;')
    expect(styleText).toContain('--color-card: #ffffff;')
    expect(styleText).toContain('--color-card: #202020;')
    expect(styleText).toContain('--color-divider: #dddddd;')
    expect(styleText).toContain('--color-divider: #333333;')

    expect(styleText).not.toContain('--color-primary-custom-dark:')
    expect(styleText).not.toContain('--color-accent-custom-dark:')
    expect(styleText).not.toContain('--color-page-custom-dark:')
    expect(styleText).not.toContain('--color-page-custom-bg-dark:')
    expect(styleText).not.toContain('--color-title-dark:')
    expect(styleText).not.toContain('--color-digest-dark:')
    expect(styleText).not.toContain('--color-card-dark:')
    expect(styleText).not.toContain('--color-divider-dark:')
  })

  it('allows generated color-mix page background values', () => {
    const styleText = serializeCommunityThemePresetCss({
      ...tokens,
      light: { ...tokens.light, gaussBlur: 45 },
    })

    expect(styleText).toContain(
      '--color-page-custom-bg: color-mix(in srgb, #ffffff 45%, transparent);',
    )
  })

  it('allows shorthand hex colors at the raw style boundary', () => {
    const styleText = serializeCommunityThemePresetCss({
      ...tokens,
      light: {
        ...tokens.light,
        primaryColor: '#123',
        accentColor: '#abcd',
        pageBg: '#fff',
        gaussBlur: 45,
      },
    })

    expect(styleText).toContain('--color-primary-custom: #123;')
    expect(styleText).toContain('--color-accent-custom: #abcd;')
    expect(styleText).toContain('--color-page-custom: #fff;')
    expect(styleText).toContain(
      '--color-page-custom-bg: color-mix(in srgb, #fff 45%, transparent);',
    )
  })

  it('omits invalid community theme preset colors at the raw style boundary', () => {
    const styleText = serializeCommunityThemePresetCss({
      ...tokens,
      light: {
        ...tokens.light,
        primaryColor: 'red;}</style><script>alert(1)</script>',
        accentColor: 'var(--malicious)',
        pageBg: '</style><script>alert(2)</script>',
        textTitle: 'expression(evil)',
        textDigest: 'red',
        cardColor: 'url(javascript:evil)',
        dividerColor: 'currentColor',
      },
      dark: {
        ...tokens.dark,
        primaryColor: '#ggg',
        accentColor: '',
        pageBg: 'var(--bad-bg)',
        gaussBlur: 40,
        textTitle: '#ff',
        textDigest: '',
        cardColor: '#22222',
        dividerColor: null as unknown as string,
      },
    })

    expect(styleText).not.toContain('--color-primary-custom:')
    expect(styleText).not.toContain('--color-accent-custom:')
    expect(styleText).not.toContain('--color-page-custom:')
    expect(styleText).not.toContain('--color-page-custom-bg:')
    expect(styleText).not.toContain('--color-title:')
    expect(styleText).not.toContain('--color-digest:')
    expect(styleText).not.toContain('--color-card:')
    expect(styleText).not.toContain('--color-divider:')
    expect(styleText).not.toContain('</style>')
    expect(styleText).not.toContain('alert(1)')
    expect(styleText).not.toContain('alert(2)')
    expect(styleText).not.toContain('var(--malicious)')
    expect(styleText).not.toContain('var(--bad-bg)')
  })
})
