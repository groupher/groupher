import { afterEach, describe, expect, it, vi } from 'vitest'

import { dismissLoginRequest, getLoginRequest } from './auth/login-request'
import PubSub from './pubsub'
import { authWarn, send, sendAsync } from './signal'

describe('signal', () => {
  afterEach(() => {
    dismissLoginRequest()
    PubSub.clearAllSubscriptions()
    vi.useRealTimers()
  })

  it('sends synchronously by default', () => {
    const subscriber = vi.fn()
    PubSub.subscribe('signal.sync', subscriber)

    send('signal.sync', { value: 1 })

    expect(subscriber).toHaveBeenCalledWith('signal.sync', { value: 1 })
  })

  it('keeps deferred delivery explicit', () => {
    vi.useFakeTimers()
    const subscriber = vi.fn()
    PubSub.subscribe('signal.async', subscriber)

    sendAsync('signal.async', { value: 1 })
    expect(subscriber).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(subscriber).toHaveBeenCalledWith('signal.async', { value: 1 })
  })

  it('forwards legacy auth warnings to the shared Login Modal request', () => {
    authWarn({ returnTo: '/home' })

    expect(getLoginRequest()).toEqual({ returnTo: '/home' })
  })
})
