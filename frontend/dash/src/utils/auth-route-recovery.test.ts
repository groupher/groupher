import { beforeEach, describe, expect, it } from 'vitest'

import {
  authRouteRecoveryKey,
  clearAuthRouteRecoveryAttempt,
  hasAuthRouteRecoveryAttempt,
  markAuthRouteRecoveryAttempt,
} from './auth-route-recovery'

describe('auth route recovery guard', () => {
  beforeEach(() => sessionStorage.clear())

  it('allows one recovery reload per URL and clears after a successful route load', () => {
    const href = 'http://dash.groupher.localhost/home/overview'

    expect(hasAuthRouteRecoveryAttempt(href)).toBe(false)

    markAuthRouteRecoveryAttempt(href)

    expect(hasAuthRouteRecoveryAttempt(href)).toBe(true)
    expect(sessionStorage.getItem(authRouteRecoveryKey(href))).toBe('attempted')

    clearAuthRouteRecoveryAttempt(href)

    expect(hasAuthRouteRecoveryAttempt(href)).toBe(false)
  })

  it('keeps recovery attempts isolated by URL', () => {
    const firstHref = 'http://dash.groupher.localhost/home/overview'
    const secondHref = 'http://dash.groupher.localhost/home/post'

    markAuthRouteRecoveryAttempt(firstHref)

    expect(hasAuthRouteRecoveryAttempt(firstHref)).toBe(true)
    expect(hasAuthRouteRecoveryAttempt(secondHref)).toBe(false)
  })
})
