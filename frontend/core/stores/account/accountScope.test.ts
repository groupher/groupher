import { getAccountScope } from './accountScope'

describe('account browser scope', () => {
  it('keeps a real anonymous login distinct from the anonymous cache partition', () => {
    expect(getAccountScope({ login: 'anonymous' })).toBe('user:anonymous')
    expect(getAccountScope(null)).toBeNull()
  })

  it('encodes delimiters before the scope is used in string storage keys', () => {
    expect(getAccountScope({ login: 'simon:other' })).toBe('user:simon%3Aother')
    expect(getAccountScope({ login: 'simon%3Aother' })).toBe('user:simon%253Aother')
  })
})
