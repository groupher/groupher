import { proxy } from 'valtio'
import OAUTH from '~/const/oauth'
import type { TAccount, TUser } from '~/spec'
import BStore from '~/utils/bstore'

import type { TStore } from './spec'

export default (): TStore => {
  const store = proxy({
    user: null,
    userSubscribedCommunities: null,

    // views
    get isLogin(): boolean {
      return !!store.user?.login
    },

    get accountInfo(): TAccount {
      const { user, isLogin } = store

      return {
        ...user,
        isLogin,
        isValidSession: false,
        isModerator: false,
      }
    },

    setSession(user: TUser, token: string): void {
      BStore.set(OAUTH.USER_KEY, JSON.stringify(user))
      BStore.set(OAUTH.TOKEN_KEY, token)

      // TODO: refactor
      try {
        store.user = user
      } catch (_e) {
        store.user = {}
      }
    },
  })

  return store
}
