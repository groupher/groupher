import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  dismissLoginRequest,
  getLoginRequest,
  requestLogin,
  subscribeLoginRequest,
} from './login-request'

describe('login request store', () => {
  afterEach(() => dismissLoginRequest())

  it('retains a request until the shared Login Modal consumes it', () => {
    requestLogin({ returnTo: '/home/doc/editor' })

    expect(getLoginRequest()).toEqual({ returnTo: '/home/doc/editor' })
  })

  it('notifies mounted UI when login is requested or dismissed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeLoginRequest(listener)

    requestLogin()
    dismissLoginRequest()
    unsubscribe()
    requestLogin()

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
