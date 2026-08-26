import { afterEach, describe, expect, it, vi } from 'vitest'

import { beginLinkedOauthAccount, listLinkedOauthAccounts, unlinkLinkedOauthAccount } from './index'

describe('Auth OAuth account helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('lists linked accounts through the canonical Auth endpoint', async () => {
    const accounts = [
      {
        avatar: null,
        canUnlink: false,
        linkedAt: '2026-08-11T00:00:00.000Z',
        login: 'octocat',
        nickname: 'Octocat',
        provider: 'github',
        publicRef: 'oauth_ref',
      },
    ]
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ accounts }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listLinkedOauthAccounts()).resolves.toEqual(accounts)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/accounts', { credentials: 'include' })
  })

  it('starts link and navigates to the returned authorization URL', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', {
      location: {
        assign,
        href: 'https://dash.groupher.localhost/account/connections',
      },
    })
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ authorizationUrl: 'https://github.com/login/oauth/authorize?state=abc' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await beginLinkedOauthAccount('github', 'https://dash.groupher.localhost/account/connections')

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/accounts/github/link', {
      body: JSON.stringify({
        returnTo: 'https://dash.groupher.localhost/account/connections',
      }),
      credentials: 'include',
      headers: {
        'X-Groupher-CSRF': '1',
        'content-type': 'application/json',
      },
      method: 'POST',
    })
    expect(assign).toHaveBeenCalledWith('https://github.com/login/oauth/authorize?state=abc')
  })

  it('unlinks by opaque public reference and preserves Auth errors', async () => {
    const accounts = []
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ accounts }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(unlinkLinkedOauthAccount('oauth/ref')).resolves.toEqual(accounts)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/accounts/oauth%2Fref/unlink', {
      credentials: 'include',
      headers: { 'X-Groupher-CSRF': '1' },
      method: 'POST',
    })
  })

  it('surfaces machine-readable account helper failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        Response.json({ code: 'OAUTH_LAST_LOGIN_METHOD' }, { status: 409 }),
      ),
    )

    await expect(unlinkLinkedOauthAccount('oauth_ref')).rejects.toMatchObject({
      code: 'OAUTH_LAST_LOGIN_METHOD',
      status: 409,
    })
  })
})
