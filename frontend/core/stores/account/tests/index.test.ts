import setupStore from '..'

import type { TUser } from '~/spec'

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
      id: 'u_1',
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
    expect(store.user?.id).toBe('u_1')
    expect(store.userSubscribedCommunities).toEqual([])

    // views
    expect(store.accountInfo.isLogin).toBe(true)
    expect(store.accountInfo.id).toBe('u_1')
    expect(store.accountInfo.isValidSession).toBe(false)
    // NOTE: current implementation always returns false in the view.
    expect(store.accountInfo.isModerator).toBe(false)

    store.commit({ user: null })
    expect(store.isLogin).toBe(false)
  })
})
