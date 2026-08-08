import { describe, expect, it } from 'vitest'

import { databaseUrlFromEnv } from './client'

describe('Press database configuration', () => {
  it('shares Phoenix DB_* connection settings without querying the cms schema', () => {
    expect(
      databaseUrlFromEnv({
        DB_HOST: '127.0.0.1',
        DB_PORT: '5433',
        DB_USERNAME: 'press',
        DB_PASSWORD: 'secret value',
        DB_NAME: 'groupher',
      }),
    ).toBe('postgresql://press:secret%20value@127.0.0.1:5433/groupher')
  })

  it('prefers a deployment DATABASE_URL', () => {
    expect(databaseUrlFromEnv({ DATABASE_URL: 'postgresql://shared/db' })).toBe(
      'postgresql://shared/db',
    )
  })
})
