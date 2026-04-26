import type { TParseDashboard } from '~/spec'

import { injectDsbColors } from './script'

describe('injectDsbColors', () => {
  it('injects primary and sub-primary custom vars for both themes', () => {
    const styleText = injectDsbColors({
      pageBg: 'CUSTOM',
      pageBgDark: 'CUSTOM',
      pageCustomBg: 190,
      pageCustomBgDark: 10,
      pageCustomIntensity: 75,
      pageCustomIntensityDark: 60,
      primaryCustomColor: '#112233',
      primaryCustomColorDark: '#223344',
      subPrimaryCustomColor: '#334455',
      subPrimaryCustomColorDark: '#445566',
    } satisfies Partial<TParseDashboard>)

    expect(styleText).toContain('--color-primary-custom: #112233;')
    expect(styleText).toContain('--color-primary-custom-dark: #223344;')
    expect(styleText).toContain('--color-sub-primary-custom: #334455;')
    expect(styleText).toContain('--color-sub-primary-custom-dark: #445566;')
    expect(styleText).toContain('--color-page-custom-light: #ecfbfe;')
    expect(styleText).toContain('--color-page-custom-dark: #3d2121;')
  })

  it('falls back to safe defaults when dashboard colors are invalid', () => {
    const styleText = injectDsbColors({
      primaryCustomColor: 'red;}</style><script>alert(1)</script>',
      primaryCustomColorDark: '#fff',
      subPrimaryCustomColor: 'var(--malicious)',
      subPrimaryCustomColorDark: '',
    } satisfies Partial<TParseDashboard>)

    expect(styleText).toContain('--color-primary-custom: #333333;')
    expect(styleText).toContain('--color-primary-custom-dark: #ffffff;')
    expect(styleText).toContain('--color-sub-primary-custom: #333333;')
    expect(styleText).toContain('--color-sub-primary-custom-dark: #ffffff;')
    expect(styleText).toContain('--color-page-custom-light: transparent;')
    expect(styleText).toContain('--color-page-custom-dark: transparent;')
    expect(styleText).not.toContain('</style>')
    expect(styleText).not.toContain('alert(1)')
    expect(styleText).not.toContain('var(--malicious)')
  })
})
