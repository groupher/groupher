import { signIn as authSignIn, signOut as authSignOut } from 'next-auth/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { signIn, signOut } from './oauth'

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

describe('signIn', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the current subdomain in the OAuth callback URL', () => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://dashboard.groupher.localhost/home/dashboard',
      },
    })

    signIn('github')

    expect(authSignIn).toHaveBeenCalledWith('github', {
      callbackUrl: 'https://dashboard.groupher.localhost/home/dashboard',
    })
  })
})

describe('signOut', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('clears Auth.js and Phoenix cookies independently', async () => {
    vi.mocked(authSignOut).mockRejectedValueOnce(new Error('Auth.js unavailable'))
    const fetchMock = vi.fn(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(signOut()).rejects.toThrow('Auth.js unavailable')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })
})
