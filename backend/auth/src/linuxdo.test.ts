import { describe, expect, it } from 'vitest'

import { linuxDoIdentity, linuxDoProvider } from './linuxdo'

describe('Linux DO Connect', () => {
  it('maps the stable id and trusted avatar template', () => {
    expect(
      linuxDoIdentity({
        id: 42,
        username: 'alice',
        name: 'Alice',
        avatar_template: '/user_avatar/linux.do/alice/{size}/1.png',
      }),
    ).toEqual({
      provider: 'linuxdo',
      providerId: '42',
      login: 'alice',
      nickname: 'Alice',
      avatar: 'https://linux.do/user_avatar/linux.do/alice/120/1.png',
    })
  })

  it('ignores untrusted avatar origins', () => {
    expect(
      linuxDoIdentity({ id: 1, avatar_template: 'https://evil.example/{size}' }).avatar,
    ).toBeUndefined()
  })

  it('uses state and PKCE for authorization', () => {
    expect(linuxDoProvider().checks).toEqual(['pkce', 'state'])
  })
})
