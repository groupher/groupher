import type { TParseDashboard } from '~/spec'

import { injectDsbColors } from './script'

describe('injectDsbColors', () => {
  it('injects primary and accent custom vars for both themes', () => {
    const styleText = injectDsbColors({
      themePreset: 'CUSTOM',
      themeTokens: {
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
      },
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

  it('falls back to safe defaults when dashboard colors are invalid', () => {
    const styleText = injectDsbColors({
      themePreset: 'CUSTOM',
      themeTokens: {
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
        dividerColorDark: null,
      },
    } satisfies Partial<TParseDashboard>)

    expect(styleText).toContain('--color-primary-custom: #7d519e;')
    expect(styleText).toContain('--color-primary-custom-dark: #9669b9;')
    expect(styleText).toContain('--color-accent-custom: #5073c6;')
    expect(styleText).toContain('--color-accent-custom-dark: #3a7ec7;')
    expect(styleText).toContain('--color-page-custom: #fffcfc;')
    expect(styleText).toContain('--color-page-custom-dark: #25161d;')
    expect(styleText).toContain('--color-title: #243041;')
    expect(styleText).toContain('--color-title-dark: #f5f5f5;')
    expect(styleText).toContain('--color-digest: #6b7280;')
    expect(styleText).toContain('--color-digest-dark: #949494;')
    expect(styleText).toContain('--color-card: #ffffff;')
    expect(styleText).toContain('--color-card-dark: #252525;')
    expect(styleText).toContain('--color-divider: #eae9e9;')
    expect(styleText).toContain('--color-divider-dark: #353535;')
    expect(styleText).not.toContain('</style>')
    expect(styleText).not.toContain('alert(1)')
    expect(styleText).not.toContain('alert(2)')
    expect(styleText).not.toContain('var(--malicious)')
    expect(styleText).not.toContain('var(--bad-bg)')
  })
})
