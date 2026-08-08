import { proxy } from 'valtio'

import type { TAccount } from '~/spec'

import type { TInit, TStore } from './spec'

export default function AccountStore(init: TInit = {}): TStore {
  const store = proxy({
    user: null,
    loading: true,
    userSubscribedCommunities: null,
    isModerator: false,

    ...init,

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
