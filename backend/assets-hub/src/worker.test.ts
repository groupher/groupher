import { describe, expect, it, vi } from 'vitest'

import worker from './worker'

describe('Assets Hub delete queue', () => {
  it('deduplicates storage keys into one R2 bulk delete and ignores invalid messages', async () => {
    const deleteObjects = vi.fn(async (_keys: string | string[]) => undefined)
    const env = {
      ASSETS_BUCKET: { delete: deleteObjects, get: vi.fn() },
    } as unknown as Env

    await worker.queue(
      {
        messages: [
          {
            body: {
              assetId: 1,
              assetPublicRef: 'asset-1',
              communityId: 1,
              storage: 'r2',
              storageKey: 'assets/one.png',
            },
          },
          {
            body: {
              assetId: 2,
              assetPublicRef: 'asset-2',
              communityId: 1,
              storage: 'r2',
              storageKey: 'assets/one.png',
            },
          },
          { body: { storage: 'local', storageKey: 'invalid' } },
        ],
      },
      env,
    )

    expect(deleteObjects).toHaveBeenCalledTimes(1)
    expect(deleteObjects).toHaveBeenCalledWith(['assets/one.png'])
  })
})
