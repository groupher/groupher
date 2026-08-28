import { afterEach, describe, expect, it, vi } from 'vitest'

import { signIn, signOut } from './oauth'

describe('signIn', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('preserves the current subdomain in the OAuth callback URL', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    const fetchMock = vi.fn(async () => Response.json({ csrfToken: 'csrf-token' }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      location: {
        href: 'https://dash.groupher.localhost/home',
      },
    })

    await signIn('github')

    const form = document.querySelector('form')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/csrf', { credentials: 'include' })
    expect(form?.getAttribute('action')).toBe('/api/auth/signin/github')
    expect(form?.getAttribute('method')).toBe('POST')
    expect(form?.querySelector<HTMLInputElement>('input[name="csrfToken"]')?.value).toBe(
      'csrf-token',
    )
    expect(form?.querySelector<HTMLInputElement>('input[name="callbackUrl"]')?.value).toBe(
      'https://dash.groupher.localhost/home',
    )
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('throws when the CSRF token is unavailable', async () => {
    const fetchMock = vi.fn(async () => Response.json({}))
    vi.stubGlobal('fetch', fetchMock)

    await expect(signIn('github')).rejects.toThrow('Auth CSRF request returned an invalid token.')
  })

  it('normalizes configured Auth endpoints before building OAuth URLs', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENDPOINT', 'https://auth.groupher.test/')
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    const fetchMock = vi.fn(async () => Response.json({ csrfToken: 'csrf-token' }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      location: {
        href: 'https://dash.groupher.localhost/home',
      },
    })
    const { signIn: configuredSignIn } = await import('./oauth')

    await configuredSignIn('github')

    const form = document.querySelector('form')
    expect(fetchMock).toHaveBeenCalledWith('https://auth.groupher.test/csrf', {
      credentials: 'include',
    })
    expect(form?.getAttribute('action')).toBe('https://auth.groupher.test/signin/github')
    expect(submit).toHaveBeenCalledTimes(1)
  })
})

describe('signOut', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('clears Auth and Phoenix cookies through the unified endpoint', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await signOut()

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      credentials: 'include',
      headers: { 'X-Groupher-CSRF': '1' },
      method: 'POST',
    })
  })

  it('throws when unified logout fails', async () => {
    const fetchMock = vi.fn(async () => new Response('failed', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(signOut()).rejects.toThrow('Auth logout failed with status 500.')
  })

  it('normalizes configured Auth endpoints before logout', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENDPOINT', 'https://auth.groupher.test/')
    const fetchMock = vi.fn(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const { signOut: configuredSignOut } = await import('./oauth')

    await configuredSignOut()

    expect(fetchMock).toHaveBeenCalledWith('https://auth.groupher.test/logout', {
      credentials: 'include',
      headers: { 'X-Groupher-CSRF': '1' },
      method: 'POST',
    })
  })
})
