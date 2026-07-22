import { describe, expect, it, vi } from 'vitest'

import { registerBeforeDashboardBack, runBeforeDashboardBack } from './beforeBack'

describe('dashboard Back guard', () => {
  it('blocks navigation until the registered cleanup succeeds', async () => {
    const cleanup = vi.fn().mockResolvedValue(false)
    const unregister = registerBeforeDashboardBack(cleanup)

    await expect(runBeforeDashboardBack()).resolves.toBe(false)
    expect(cleanup).toHaveBeenCalledOnce()

    unregister()
    await expect(runBeforeDashboardBack()).resolves.toBe(true)
  })
})
