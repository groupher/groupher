/** Verifies the Worker health deployment identity independently of database access. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class {} }))
vi.mock('./runtime', () => ({ handlePressRequest: vi.fn() }))

import worker from './worker'

describe('Worker health', () => {
  it.each(['production', 'preview'])(
    'reports the deployed version and %s environment',
    async (environment) => {
      const env = {
        NODE_ENV: environment,
        CF_VERSION_METADATA: { id: 'deployed-version-id' },
      } as Env
      const response = await worker.fetch(
        new Request('https://press.invalid/health'),
        env,
        {} as ExecutionContext,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toMatchObject({
        service: 'press',
        version: 'deployed-version-id',
        environment,
      })
    },
  )
})
