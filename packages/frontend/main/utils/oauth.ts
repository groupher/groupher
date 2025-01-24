import { signOut as authSignOut, signIn as authSignIn } from 'next-auth/react'

import BStore from '~/utils/bstore'
import OAUTH from '~/const/oauth'

export const signOut = () => {
  authSignOut()
  BStore.remove(OAUTH.TOKEN_KEY)
  BStore.remove(OAUTH.USER_KEY)
  BStore.cookie.remove(OAUTH.TOKEN_KEY)
  BStore.cookie.remove(OAUTH.USER_KEY)
}

export const signIn = (provider: string): void => {
  // signIn('github', { callbackUrl: '/home/post' })
  authSignIn(provider)
}
