import type { TUser } from '~/spec'

import setupStore from '..'

describe('stores/account', () => {
  it('defaults to logged-out state and updates derived views after commit', () => {
    const store = setupStore()

    expect(store.user).toBeNull()
    expect(store.loading).toBe(true)
    expect(store.isLogin).toBe(false)

    // object spread on null should not crash and should still return view flags
    expect(store.accountInfo.isLogin).toBe(false)
    expect(store.accountInfo.isValidSession).toBe(false)
    expect(store.accountInfo.isModerator).toBe(false)

    const complexUser: TUser = {
      login: 'edge_user',
      nickname: '',
      bio: '',
      avatar: '',
    }

    store.commit({
      loading: false,
      user: complexUser,
      isModerator: true,
      userSubscribedCommunities: [],
    })

    expect(store.loading).toBe(false)
    expect(store.isLogin).toBe(true)
    expect(store.user?.login).toBe('edge_user')
    expect(store.userSubscribedCommunities).toEqual([])

    // views
    expect(store.accountInfo.isLogin).toBe(true)
    expect(store.accountInfo.login).toBe('edge_user')
    expect(store.accountInfo.isValidSession).toBe(false)
    // NOTE: current implementation always returns false in the view.
    expect(store.accountInfo.isModerator).toBe(false)

    store.commit({ user: null })
    expect(store.isLogin).toBe(false)
  })
})
