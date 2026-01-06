import { proxy } from 'valtio'
import type { TAccount } from '~/spec'

import type { TStore } from './spec'

export default (): TStore => {
  const store = proxy({
    user: null,
    loading: true,
    userSubscribedCommunities: null,
    isModerator: false,

    // views
    get isLogin(): boolean {
      return !!store.user
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

    commit(patch: Partial<TStore>): void {
      Object.assign(store, patch)
    },
  })

  return store
}
