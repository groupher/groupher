import { signIn as authSignIn } from 'next-auth/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { signIn } from './oauth'

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
