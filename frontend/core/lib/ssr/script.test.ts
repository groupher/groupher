import type { TParseDashboard, TResolvedThemePreset } from '~/spec'

import { injectDsbColors } from './script'

const makeTokens = (tokens: Partial<TResolvedThemePreset>): TResolvedThemePreset => ({
  pageBg: '#ffffff',
  pageBgDark: '#101010',
  pageBgHue: 0,
  pageBgHueDark: 0,
  pageBgIntensity: 0,
  pageBgIntensityDark: 0,
  primaryColor: '#112233',
  primaryColorDark: '#223344',
  accentColor: '#334455',
  accentColorDark: '#445566',
  textTitle: '#102030',
  textTitleDark: '#ddeeff',
  textDigest: '#405060',
  textDigestDark: '#aabbcc',
  cardColor: '#f8f9fa',
  cardColorDark: '#202124',
  dividerColor: '#dadce0',
  dividerColorDark: '#3c4043',
  gaussBlur: 100,
  gaussBlurDark: 100,
  glowType: '',
  glowTypeDark: '',
  glowFixed: true,
  glowOpacity: 100,
  glowOpacityDark: 100,
  ...tokens,
})

describe('injectDsbColors', () => {
  it('injects primary and accent custom vars for both themes', () => {
    const styleText = injectDsbColors({
      themePreset: 'CUSTOM',
      themeTokens: makeTokens({
        primaryColor: '#112233',
        primaryColorDark: '#223344',
        accentColor: '#334455',
        accentColorDark: '#445566',
        pageBg: '#ecfbfe',
        pageBgDark: '#3d2121',
        textTitle: '#102030',
        textTitleDark: '#ddeeff',
        textDigest: '#405060',
        textDigestDark: '#aabbcc',
        cardColor: '#f8f9fa',
        cardColorDark: '#202124',
        dividerColor: '#dadce0',
        dividerColorDark: '#3c4043',
      }),
    } satisfies Partial<TParseDashboard>)

    expect(styleText).toContain('--color-primary-custom: #112233;')
    expect(styleText).toContain('--color-primary-custom-dark: #223344;')
    expect(styleText).toContain('--color-accent-custom: #334455;')
    expect(styleText).toContain('--color-accent-custom-dark: #445566;')
    expect(styleText).toContain('--color-page-custom: #ecfbfe;')
    expect(styleText).toContain('--color-page-custom-dark: #3d2121;')
    expect(styleText).toContain('--color-title: #102030;')
    expect(styleText).toContain('--color-title-dark: #ddeeff;')
    expect(styleText).toContain('--color-digest: #405060;')
    expect(styleText).toContain('--color-digest-dark: #aabbcc;')
    expect(styleText).toContain('--color-card: #f8f9fa;')
    expect(styleText).toContain('--color-card-dark: #202124;')
    expect(styleText).toContain('--color-divider: #dadce0;')
    expect(styleText).toContain('--color-divider-dark: #3c4043;')
  })

  it('omits invalid dashboard colors at the raw SSR injection boundary', () => {
    const styleText = injectDsbColors({
      themePreset: 'CUSTOM',
      themeTokens: makeTokens({
        primaryColor: 'red;}</style><script>alert(1)</script>',
        primaryColorDark: '#fff',
        accentColor: 'var(--malicious)',
        accentColorDark: '',
        pageBg: '</style><script>alert(2)</script>',
        pageBgDark: 'var(--bad-bg)',
        textTitle: 'expression(evil)',
        textTitleDark: '#fff',
        textDigest: 'red',
        textDigestDark: '',
        cardColor: 'url(javascript:evil)',
        cardColorDark: '#222',
        dividerColor: 'currentColor',
        dividerColorDark: null as unknown as string,
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
