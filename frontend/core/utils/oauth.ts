import { signIn as authSignIn, signOut as authSignOut } from 'next-auth/react'
import type { TOauthProvider } from '~/spec'
import { removeAuth } from '~/utils/localStorage'

export const signOut = async () => {
  await authSignOut({ redirect: false })
  removeAuth()

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
