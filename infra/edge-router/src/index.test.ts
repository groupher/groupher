import { GROUPHER_AUTH_CSRF_HEADER, GROUPHER_AUTH_CSRF_VALUE } from '@groupher/contracts/auth'
import { describe, expect, it, vi } from 'vitest'

import worker from './index'

const fetcher = (name: string) => ({
  fetch: vi.fn(async (request: Request) =>
    Response.json({ name, url: request.url, headers: Object.fromEntries(request.headers) }),
  ),
})

const createEnv = () =>
  ({
    LANDING: fetcher('landing'),
    COMMUNITY: fetcher('community'),
    AUTH: fetcher('auth'),
    API_SITE: 'https://api.groupher.com',
    PRESS_SITE: 'https://press.groupher.com',
    CUSTOM_DOMAIN_COMMUNITIES: '{"talk.example.com":"home"}',
    NODE_ENV: 'test',
    CF_VERSION_METADATA: { id: 'version-1', tag: '', timestamp: '2026-08-24T00:00:00Z' },
  }) as unknown as Env

const dispatch = (request: Request, env = createEnv()) =>
  worker.fetch(request as Parameters<typeof worker.fetch>[0], env)

describe('edge-router', () => {
  it('owns only the exact health endpoint', async () => {
    const health = await dispatch(new Request('https://groupher.com/health'))
    expect(health.status).toBe(200)
    expect(await health.json()).toMatchObject({
      service: 'edge-router',
      version: 'version-1',
      uptimeMs: expect.any(Number),
    })
    expect((await dispatch(new Request('https://groupher.com/health/dash'))).status).toBe(404)
  })

  it('uses Service Bindings for first-party Workers', async () => {
    const env = createEnv()
    await dispatch(new Request('https://groupher.com/pricing'), env)
    await dispatch(new Request('https://groupher.com/home'), env)
    await dispatch(new Request('https://groupher.com/api/auth/session'), env)

    expect(env.LANDING.fetch).toHaveBeenCalledOnce()
    expect(env.COMMUNITY.fetch).toHaveBeenCalledOnce()
    expect(env.AUTH.fetch).toHaveBeenCalledOnce()
  })

  it('maps Landing public assets to the Vite static bundle', async () => {
    const env = createEnv()
    await dispatch(new Request('https://groupher.com/landing/assets/app.js'), env)

    const request = vi.mocked(env.LANDING.fetch).mock.calls[0][0] as Request
    expect(new URL(request.url).pathname).toBe('/assets/app.js')
  })

  it('rewrites custom domains internally while preserving the public host', async () => {
    const env = createEnv()
    const response = await dispatch(
      new Request('https://talk.example.com/post/123', {
        headers: {
          'x-forwarded-host': 'spoofed.example.com',
          'x-groupher-community-slug': 'spoofed',
        },
      }),
      env,
    )
    const body = (await response.json()) as { url: string; headers: Record<string, string> }

    expect(body.url).toBe('https://talk.example.com/home/post/123')
    expect(body.headers['x-forwarded-host']).toBe('talk.example.com')
    expect(body.headers['x-forwarded-proto']).toBe('https')
    expect(body.headers['x-groupher-community-slug']).toBe('home')
  })

  it('cleans credentials from Press output', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    await dispatch(
      new Request('https://groupher.com/home/post/a.md', {
        headers: { authorization: 'Bearer secret', cookie: 'private=yes' },
      }),
    )

    const forwarded = fetchSpy.mock.calls[0][0] as Request
    expect(forwarded.url).toBe('https://press.groupher.com/home/post/a.md')
    expect(forwarded.headers.has('authorization')).toBe(false)
    expect(forwarded.headers.has('cookie')).toBe(false)
  })

  it('enforces browser GraphQL CSRF and keeps only the Groupher auth cookie', async () => {
    expect(
      (
        await dispatch(
          new Request('https://groupher.com/api/graphql', { method: 'POST', body: '{}' }),
        )
      ).status,
    ).toBe(400)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    await dispatch(
      new Request('https://groupher.com/api/graphql?op=viewer', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
          authorization: 'Bearer secret',
          cookie: 'other=no; groupher-auth.token=token%20value',
        },
        body: '{}',
      }),
    )

    const forwarded = fetchSpy.mock.calls[0][0] as Request
    expect(forwarded.url).toBe('https://api.groupher.com/graphiql?op=viewer')
    expect(forwarded.headers.has('authorization')).toBe(false)
    expect(forwarded.headers.get('cookie')).toBe('groupher-auth.token=token%20value')
  })

  it('does not know independent product hosts or removed root paths', async () => {
    expect((await dispatch(new Request('https://dash.groupher.com/'))).status).toBe(404)
    expect((await dispatch(new Request('https://groupher.com/apply'))).status).toBe(404)
    expect((await dispatch(new Request('https://groupher.com/home/dashboard'))).status).toBe(404)
  })

  it('accepts local platform hosts only in the development configuration', async () => {
    expect((await dispatch(new Request('https://groupher.localhost/health'))).status).toBe(404)

    const env = { ...createEnv(), NODE_ENV: 'development' } as unknown as Env
    expect((await dispatch(new Request('https://groupher.localhost/health'), env)).status).toBe(200)
    expect((await dispatch(new Request('http://localhost/health'), env)).status).toBe(200)
    expect((await dispatch(new Request('http://127.0.0.1/health'), env)).status).toBe(200)
  })
})
