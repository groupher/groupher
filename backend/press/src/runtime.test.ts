/**
 * Verifies Press invocation cleanup after response metrics.
 *
 * Business position:
 *
 *   Worker response
 *     -> pending metrics
 *     -> awaited pg.Client close
 */

import { describe, expect, it, vi } from 'vitest'

import { finishPressRequest } from './runtime'

describe('finishPressRequest', () => {
  it('waits for pending metrics before closing the client', async () => {
    let resolveMetric: (() => void) | undefined
    const metric = new Promise<void>((resolve) => {
      resolveMetric = resolve
    })
    const end = vi.fn(async () => {})

    const finished = finishPressRequest({ end }, [metric])
    await Promise.resolve()
    expect(end).not.toHaveBeenCalled()

    resolveMetric?.()
    await finished
    expect(end).toHaveBeenCalledOnce()
  })

  it('closes the client even when a metric fails', async () => {
    const end = vi.fn(async () => {})

    await finishPressRequest({ end }, [Promise.reject(new Error('metric failed'))])

    expect(end).toHaveBeenCalledOnce()
  })

  it('awaits client close before resolving', async () => {
    let resolveClose: (() => void) | undefined
    const end = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve
        }),
    )

    const finished = finishPressRequest({ end }, [])
    await Promise.resolve()
    expect(end).toHaveBeenCalledOnce()

    let settled = false
    void finished.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    resolveClose?.()
    await finished
    expect(settled).toBe(true)
  })
})
