import { signIn as authSignIn, signOut as authSignOut } from 'next-auth/react'

import { LOGOUT_ENDPOINT } from '~/const/oauth'
import type { TOauthProvider } from '~/spec'

import { logout } from './signal'

export const signOut = async (onComplete?: () => void) => {
  // Clear local login-dependent UI first so the next render stays consistent
  // while NextAuth and backend cookies are being revoked.
  logout()

  await authSignOut({ redirect: false })
  await fetch(LOGOUT_ENDPOINT, { method: 'POST' })

  onComplete?.()
}

export const signIn = (
  provider: TOauthProvider,
  options?: {
    callbackUrl?: string
  },
) => {
  const callbackUrl = options?.callbackUrl ?? `${window.location.pathname}${window.location.search}`

  return authSignIn(provider, {
    callbackUrl,
  })
}
