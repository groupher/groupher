import { proxy } from 'valtio'
import { AUTH_KEY } from '~/const/oauth'
import type { TAccount, TUser } from '~/spec'
import BStore from '~/utils/bstore'

import type { TStore } from './spec'

export default (): TStore => {
  const store = proxy({
    user: null,
    userSubscribedCommunities: null,
    isModerator: false,

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
      BStore.set(AUTH_KEY.USER, JSON.stringify(user))
      BStore.set(AUTH_KEY.TOKEN, token)

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
