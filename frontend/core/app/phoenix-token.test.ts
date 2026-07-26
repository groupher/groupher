import { describe, expect, it } from 'vitest'

import { getPhoenixToken } from './phoenix-token'

describe('getPhoenixToken', () => {
  it('reads the canonical Phoenix token cookie', () => {
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: 'theme=dark; groupher-auth.token=phoenix-token',
      },
    })

    expect(getPhoenixToken(request)).toBe('phoenix-token')
  })

  it('does not read the Auth.js Session cookie', () => {
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: '__Secure-groupher-auth.session-token=auth-session',
      },
    })

    expect(getPhoenixToken(request)).toBeNull()
  })
})
