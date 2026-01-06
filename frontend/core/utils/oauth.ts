import { signIn as authSignIn, signOut as authSignOut } from 'next-auth/react'
import { LOGOUT_ENDPOINT } from '~/const/oauth'
import type { TOauthProvider } from '~/spec'

export const signOut = async () => {
  await authSignOut({ redirect: false })
  await fetch(LOGOUT_ENDPOINT, { method: 'POST' })

  window.location.reload()
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
