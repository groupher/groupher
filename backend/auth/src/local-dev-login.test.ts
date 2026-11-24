import { describe, expect, it, vi } from 'vitest'

import { signinOauth } from './auth'
import {
  createLocalDevLoginHandlers,
  isLocalDevAdminLoginEnabled,
  isLocalDevLoginRequest,
} from './local-dev-login'

vi.mock('./auth', () => ({
  appendPhoenixTokenCookie: vi.fn((response: Response) => response),
  BROWSER_SESSION_MAX_AGE: 3_600,
  BROWSER_SESSION_USER_AGENT_MAX_LENGTH: 200,
  signinOauth: vi.fn(async () => ({
    browserSessionRef: 'browser-session-ref',
    sessionAbsoluteExpiresAt: new Date(Date.now() + 600_000).toISOString(),
  })),
}))

describe('local Passport admin login gate', () => {
  it('requires both local login flags outside production', () => {
    expect(
      isLocalDevAdminLoginEnabled({
        NODE_ENV: 'development',
        AUTH_LOCAL_LOGIN_ENABLED: 'true',
        AUTH_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      }),
    ).toBe(true)
    expect(
      isLocalDevAdminLoginEnabled({
        NODE_ENV: 'development',
        AUTH_LOCAL_LOGIN_ENABLED: 'true',
        AUTH_LOCAL_ADMIN_LOGIN_ENABLED: 'false',
      }),
    ).toBe(false)
    expect(
      isLocalDevAdminLoginEnabled({
        NODE_ENV: 'production',
        AUTH_LOCAL_LOGIN_ENABLED: 'true',
        AUTH_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      }),
    ).toBe(false)
    expect(
      createLocalDevLoginHandlers({
        NODE_ENV: ' Production ',
        AUTH_LOCAL_LOGIN_ENABLED: 'true',
        AUTH_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      }),
    ).toEqual({})
  })

  it('registers only the ordinary handler by default and both handlers with explicit local opt-in', () => {
    expect(createLocalDevLoginHandlers({ NODE_ENV: 'development' })).toEqual({})
    expect(
      createLocalDevLoginHandlers({
        NODE_ENV: 'production',
        AUTH_LOCAL_LOGIN_ENABLED: 'true',
        AUTH_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      }),
    ).toEqual({})

    const ordinary = createLocalDevLoginHandlers({
      NODE_ENV: 'development',
      AUTH_LOCAL_LOGIN_ENABLED: 'true',
      NEXTAUTH_SECRET: 'test-secret',
    })
    expect(typeof ordinary.testLogin).toBe('function')
    expect(ordinary).not.toHaveProperty('testAdminLogin')

    const admin = createLocalDevLoginHandlers({
      NODE_ENV: 'development',
      AUTH_LOCAL_LOGIN_ENABLED: 'true',
      AUTH_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      NEXTAUTH_SECRET: 'test-secret',
    })
    expect(typeof admin.testLogin).toBe('function')
    expect(typeof admin.testAdminLogin).toBe('function')
  })

  it('restricts local login handlers to loopback Auth hosts', async () => {
    expect(
      isLocalDevLoginRequest(new Request('https://auth.groupher.localhost/api/auth/test-login')),
    ).toBe(true)
    expect(
      isLocalDevLoginRequest(new Request('https://auth.groupher.com/api/auth/test-login')),
    ).toBe(false)

    const handlers = createLocalDevLoginHandlers({
      NODE_ENV: 'development',
      AUTH_LOCAL_LOGIN_ENABLED: 'true',
      NEXTAUTH_SECRET: 'test-secret',
    })
    const response = await handlers.testLogin!(
      new Request('https://auth.groupher.com/api/auth/test-login'),
    )
    expect(response.status).toBe(400)
  })

  it('ignores caller-selected login identities for ordinary and opt-in Admin sessions', async () => {
    vi.mocked(signinOauth).mockClear()
    const request = () =>
      new Request('https://auth.groupher.localhost/api/auth/test-login', {
        method: 'POST',
        body: JSON.stringify({ login: 'attacker-chosen-user' }),
      })
    const ordinary = createLocalDevLoginHandlers({
      NODE_ENV: 'development',
      AUTH_LOCAL_LOGIN_ENABLED: 'true',
      NEXTAUTH_SECRET: 'local-test-secret-that-is-at-least-32-bytes',
    })
    const ordinaryResponse = await ordinary.testLogin!(request())
    expect(ordinaryResponse.status).toBe(204)
    expect(vi.mocked(signinOauth).mock.calls[0]?.[0]).toMatchObject({
      login: 'local-debug',
      providerId: 'local-debug',
    })

    const admin = createLocalDevLoginHandlers({
      NODE_ENV: 'development',
      AUTH_LOCAL_LOGIN_ENABLED: 'true',
      AUTH_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      NEXTAUTH_SECRET: 'local-test-secret-that-is-at-least-32-bytes',
    })
    const adminResponse = await admin.testAdminLogin!(request())
    expect(adminResponse.status).toBe(204)
    expect(vi.mocked(signinOauth).mock.calls[1]?.[0]).toMatchObject({
      login: 'local-passport-admin',
      providerId: 'local-passport-admin',
    })
  })
})
