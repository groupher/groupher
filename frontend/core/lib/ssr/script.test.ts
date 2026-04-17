import { injectDsbColors } from './script'

describe('injectDsbColors', () => {
  it('injects primary and sub-primary custom vars for both themes', () => {
    const styleText = injectDsbColors({
      primaryCustomColor: '#112233',
      primaryCustomColorDark: '#223344',
      subPrimaryCustomColor: '#334455',
      subPrimaryCustomColorDark: '#445566',
    } as any)

    expect(styleText).toContain('--color-primary-custom: #112233;')
    expect(styleText).toContain('--color-primary-custom-dark: #223344;')
    expect(styleText).toContain('--color-sub-primary-custom: #334455;')
    expect(styleText).toContain('--color-sub-primary-custom-dark: #445566;')
  })

  it('falls back to safe defaults when dashboard colors are invalid', () => {
    const styleText = injectDsbColors({
      primaryCustomColor: 'red;}</style><script>alert(1)</script>',
      primaryCustomColorDark: '#fff',
      subPrimaryCustomColor: 'var(--malicious)',
      subPrimaryCustomColorDark: '',
    } as any)

    expect(styleText).toContain('--color-primary-custom: #333333;')
    expect(styleText).toContain('--color-primary-custom-dark: #ffffff;')
    expect(styleText).toContain('--color-sub-primary-custom: #333333;')
    expect(styleText).toContain('--color-sub-primary-custom-dark: #ffffff;')
    expect(styleText).not.toContain('</style>')
    expect(styleText).not.toContain('alert(1)')
    expect(styleText).not.toContain('var(--malicious)')
  })
})
