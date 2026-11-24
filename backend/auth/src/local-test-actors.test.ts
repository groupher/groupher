import { describe, expect, it, vi } from 'vitest'

import { localTestActorLogin, localTestActorsEnabled } from './local-test-actors'

const environment = {
  DEV_HUB_MANAGED_ENVIRONMENT: 'true',
  LOCAL_TEST_ACTORS_SECRET: 'a'.repeat(43),
  NEXTAUTH_SECRET: 'test-only-secret',
}
const loginRequest = (origin = 'https://auth.groupher.localhost') =>
  new Request(`${origin}/api/auth/test-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://dash.groupher.localhost' },
    body: JSON.stringify({ localActor: { run: 'demo', alias: 'alice', community: 'home' } }),
  })

describe('local actor login boundary', () => {
  it('accepts the TLS-terminated local host but rejects a production browser Origin', async () => {
    const backend = vi.fn(async () =>
      Response.json({ error: 'actor_unavailable' }, { status: 400 }),
    )
    expect(
      (
        await localTestActorLogin(
          environment,
          backend,
        )(loginRequest('http://auth.groupher.localhost'))
      ).status,
    ).toBe(403)
    expect(backend).toHaveBeenCalledOnce()
    backend.mockClear()
    const request = loginRequest()
    request.headers.set('Origin', 'https://dash.groupher.com')
    expect((await localTestActorLogin(environment, backend)(request)).status).toBe(404)
    expect(backend).not.toHaveBeenCalled()
  })
  it('rejects deployment markers even when all local secrets and flags are set', async () => {
    for (const key of ['NODE_ENV', 'CLOUDFLARE_ENV', 'ENVIRONMENT']) {
      for (const value of ['production', 'staging', 'preview']) {
        const env = { ...environment, [key]: value }
        expect(localTestActorsEnabled(env)).toBe(false)
        const backend = vi.fn()
        expect((await localTestActorLogin(env, backend)(loginRequest())).status).toBe(404)
        expect(backend).not.toHaveBeenCalled()
      }
    }
  })
  it('rejects non-local hosts without contacting Phoenix', async () => {
    const backend = vi.fn()
    expect(
      (await localTestActorLogin(environment, backend)(loginRequest('https://auth.groupher.com')))
        .status,
    ).toBe(404)
    expect(backend).not.toHaveBeenCalled()
  })
  it('does not issue cookies when Phoenix rejects the identity, scope or database', async () => {
    const backend = vi.fn(async () =>
      Response.json({ error: 'local_test_database_required' }, { status: 400 }),
    )
    const result = await localTestActorLogin(environment, backend)(loginRequest())
    expect(result.status).toBe(403)
    expect(result.headers.has('set-cookie')).toBe(false)
    expect(backend.mock.calls).toHaveLength(1)
  })
})
