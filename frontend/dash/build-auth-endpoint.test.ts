import { describe, expect, it } from 'vitest'

import { buildAuthEndpoint } from './build-auth-endpoint'

describe('Dash production Auth endpoint', () => {
  it('rejects local endpoints before producing a production bundle', () => {
    for (const value of [
      'https://auth.groupher-feature.localhost/api/auth',
      'http://localhost:3004/api/auth',
      'http://127.0.0.1:3004/api/auth',
      'http://[::1]:3004/api/auth',
      'https://user:secret@auth.example.com/api/auth',
      'not-a-url',
    ]) {
      expect(() => buildAuthEndpoint(value, true)).toThrow()
    }
  })

  it('preserves normal production overrides and development addresses', () => {
    expect(buildAuthEndpoint(undefined, true)).toBeUndefined()
    expect(buildAuthEndpoint('https://auth.example.com/api/auth', true)).toBe(
      'https://auth.example.com/api/auth',
    )
    expect(buildAuthEndpoint('https://auth.groupher.localhost/api/auth', false)).toBe(
      'https://auth.groupher.localhost/api/auth',
    )
  })
})
