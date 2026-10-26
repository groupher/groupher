/**
 * Verifies the scheduled retention connection lifecycle.
 *
 * Business position:
 *
 *   Cron invocation
 *     -> connect and prune expired rows
 *     -> awaited pg.Client close
 */

import { describe, expect, it, vi } from 'vitest'

import { runRetentionWithClient } from './retention'

describe('runRetentionWithClient', () => {
  it('connects, runs retention, and awaits client close', async () => {
    const calls: string[] = []
    const client = {
      async connect() {
        calls.push('connect')
      },
      async end() {
        calls.push('end')
      },
    }
    const run = vi.fn(async () => {
      calls.push('retention')
    })

    await runRetentionWithClient(client, run)

    expect(calls).toEqual(['connect', 'retention', 'end'])
    expect(run).toHaveBeenCalledOnce()
  })

  it('closes the client when connect fails', async () => {
    const end = vi.fn(async () => {})
    const client = {
      async connect() {
        throw new Error('connect failed')
      },
      end,
    }

    await expect(runRetentionWithClient(client, async () => {})).rejects.toThrow('connect failed')
    expect(end).toHaveBeenCalledOnce()
  })

  it('closes the client when retention fails', async () => {
    const end = vi.fn(async () => {})
    const client = {
      async connect() {},
      end,
    }

    await expect(
      runRetentionWithClient(client, async () => {
        throw new Error('retention failed')
      }),
    ).rejects.toThrow('retention failed')
    expect(end).toHaveBeenCalledOnce()
  })
})
