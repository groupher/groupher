import { signIn as authSignIn, signOut as authSignOut } from 'next-auth/react'

import { LOGOUT_ENDPOINT } from '~/const/oauth'
import type { TOauthProvider } from '~/spec'

import { logout } from './signal'

export const signOut = async (onComplete?: () => void) => {
  // Clear local login-dependent UI first so the next render stays consistent
  // while NextAuth and backend cookies are being revoked.
  logout()

  const results = await Promise.allSettled([
    authSignOut({ redirect: false }),
    fetch(LOGOUT_ENDPOINT, { method: 'POST' }),
  ])
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (failed) throw failed.reason

  onComplete?.()
}

export const signIn = (
  provider: TOauthProvider,
  options?: {
    callbackUrl?: string
  },
) => {
  const callbackUrl = options?.callbackUrl ?? window.location.href

  return authSignIn(provider, {
    callbackUrl,
  })
}
