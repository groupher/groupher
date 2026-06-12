import { THEME_PRESET } from '~/const/theme_preset'
import type { TParseDashboard, TResolvedThemePreset } from '~/spec'

import { injectDsbColors } from './script'

type TResolvedThemePresetPatch = {
  shared?: Partial<TResolvedThemePreset['shared']>
  light?: Partial<TResolvedThemePreset['light']>
  dark?: Partial<TResolvedThemePreset['dark']>
}

const makeTokens = (tokens: TResolvedThemePresetPatch): TResolvedThemePreset => ({
  shared: { glowFixed: true, ...tokens.shared },
  light: {
    pageBg: '#ffffff',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#112233',
    accentColor: '#334455',
    textTitle: '#102030',
    textDigest: '#405060',
    cardColor: '#f8f9fa',
    dividerColor: '#dadce0',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
    ...tokens.light,
  },
  dark: {
    pageBg: '#101010',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#223344',
    accentColor: '#445566',
    textTitle: '#ddeeff',
    textDigest: '#aabbcc',
    cardColor: '#202124',
    dividerColor: '#3c4043',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
    ...tokens.dark,
  },
})

describe('injectDsbColors', () => {
  it('injects primary and accent custom vars for both themes', () => {
    const styleText = injectDsbColors({
      themePreset: THEME_PRESET.CUSTOM,
      themeTokens: makeTokens({
        light: {
          primaryColor: '#112233',
          accentColor: '#334455',
          pageBg: '#ecfbfe',
          textTitle: '#102030',
          textDigest: '#405060',
          cardColor: '#f8f9fa',
          dividerColor: '#dadce0',
        },
        dark: {
          primaryColor: '#223344',
          accentColor: '#445566',
          pageBg: '#3d2121',
          textTitle: '#ddeeff',
          textDigest: '#aabbcc',
          cardColor: '#202124',
          dividerColor: '#3c4043',
        },
      }),
    } satisfies Partial<TParseDashboard>)

    expect(styleText).toContain('--color-primary-custom: #112233;')
    expect(styleText).toContain('--color-primary-custom: #223344;')
    expect(styleText).toContain('--color-accent-custom: #334455;')
    expect(styleText).toContain('--color-accent-custom: #445566;')
    expect(styleText).toContain('--color-page-custom: #ecfbfe;')
    expect(styleText).toContain('--color-page-custom: #3d2121;')
    expect(styleText).toContain('--color-title: #102030;')
    expect(styleText).toContain('--color-title: #ddeeff;')
    expect(styleText).toContain('--color-digest: #405060;')
    expect(styleText).toContain('--color-digest: #aabbcc;')
    expect(styleText).toContain('--color-card: #f8f9fa;')
    expect(styleText).toContain('--color-card: #202124;')
    expect(styleText).toContain('--color-divider: #dadce0;')
    expect(styleText).toContain('--color-divider: #3c4043;')

    expect(styleText).not.toContain('--color-primary-custom-dark:')
    expect(styleText).not.toContain('--color-accent-custom-dark:')
    expect(styleText).not.toContain('--color-page-custom-dark:')
    expect(styleText).not.toContain('--color-title-dark:')
    expect(styleText).not.toContain('--color-digest-dark:')
    expect(styleText).not.toContain('--color-card-dark:')
    expect(styleText).not.toContain('--color-divider-dark:')
  })

  it('omits invalid dashboard colors at the raw SSR injection boundary', () => {
    const styleText = injectDsbColors({
      themePreset: THEME_PRESET.CUSTOM,
      themeTokens: makeTokens({
        light: {
          primaryColor: 'red;}</style><script>alert(1)</script>',
          accentColor: 'var(--malicious)',
          pageBg: '</style><script>alert(2)</script>',
          textTitle: 'expression(evil)',
          textDigest: 'red',
          cardColor: 'url(javascript:evil)',
          dividerColor: 'currentColor',
        },
        dark: {
          primaryColor: '#fff',
          accentColor: '',
          pageBg: 'var(--bad-bg)',
          textTitle: '#fff',
          textDigest: '',
          cardColor: '#222',
          dividerColor: null as unknown as string,
        },
      }),
    } satisfies Partial<TParseDashboard>)

    expect(styleText).not.toContain('--color-primary-custom:')
    expect(styleText).not.toContain('--color-accent-custom:')
    expect(styleText).not.toContain('--color-page-custom:')
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
