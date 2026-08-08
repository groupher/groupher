import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TToastItem } from './spec'

const loadStore = async () => {
  vi.resetModules()
  return import('./store')
}

describe('Toaster store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('publishes and auto-removes toast items', async () => {
    const { subscribeToast, toast } = await loadStore()
    const snapshots: TToastItem[][] = []

    subscribeToast((items) => snapshots.push(items))
    toast('saved')

    expect(snapshots.at(-1)?.map((item) => item.message)).toEqual(['saved'])

    vi.advanceTimersByTime(2400)

    expect(snapshots.at(-1)).toEqual([])
  })

  it('keeps only the latest visible toast items', async () => {
    const { subscribeToast, toast } = await loadStore()
    const snapshots: TToastItem[][] = []

    subscribeToast((items) => snapshots.push(items))
    toast('one')
    toast('two')
    toast('three')
    toast('four')

    expect(snapshots.at(-1)?.map((item) => item.message)).toEqual(['two', 'three', 'four'])
  })

  it('merges repeated messages by type', async () => {
    const { subscribeToast, toast } = await loadStore()
    const snapshots: TToastItem[][] = []

    subscribeToast((items) => snapshots.push(items))
    const firstId = toast('retry', 'error')
    const secondId = toast('retry', 'error')

    expect(secondId).toBe(firstId)
    expect(snapshots.at(-1)).toHaveLength(1)
    expect(snapshots.at(-1)?.[0]?.type).toBe('error')
  })
})
