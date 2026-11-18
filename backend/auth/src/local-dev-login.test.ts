import { describe, expect, it } from 'vitest'

import { isLocalDevAdminLoginEnabled } from './local-dev-login'

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
  })
})
