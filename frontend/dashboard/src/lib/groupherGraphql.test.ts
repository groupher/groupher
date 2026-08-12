import { describe, expect, it, vi } from 'vitest'

vi.mock('~/config', () => ({ GRAPHQL_ENDPOINT: 'https://example.test/graphql' }))
import { requestGroupherGraphQL } from './groupherGraphql'

describe('requestGroupherGraphQL', () => {
  it('preserves structured changeset messages and codes', async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({
        errors: [
          {
            code: 'changeset',
            message: [
              { key: 'plain text', message: 'cannot be empty' },
              { key: 'json', message: 'is invalid' },
            ],
          },
        ],
      })

    await expect(
      requestGroupherGraphQL('query Example { example }', {}, { fetchImpl }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'changeset',
        message: 'plain text: cannot be empty; json: is invalid',
      }),
    )
  })
})
