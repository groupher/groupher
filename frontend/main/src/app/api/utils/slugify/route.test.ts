import { describe, expect, it } from 'vitest'

import { POST } from './route'

describe('main /api/utils/slugify', () => {
  it('reuses the shared slugify route handler', async () => {
    const response = await POST(
      new Request('http://localhost/api/utils/slugify', {
        method: 'POST',
        body: JSON.stringify({ value: 'Main中文 Tag' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, slug: 'main-zhong-wen-tag' })
  })
})
