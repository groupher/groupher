import { signIn as authSignIn, signOut as authSignOut } from 'next-auth/react'
import type { TOauthProvider } from '~/spec'

// const _deleteCookie = async () => {
//   await fetch('/api/auth-cleanup', {
//     method: 'POST',
//     headers: {
//       Accept: 'application/json',
//     },
//   })
// }

export const signOut = async () => {
  await authSignOut({ redirect: false })

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
