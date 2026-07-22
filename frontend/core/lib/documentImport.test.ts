import { afterEach, describe, expect, it, vi } from 'vitest'

import { importDocumentationPlatform } from './documentImport'

describe('document import client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the importer summary instead of a low-level diagnostic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: {
              diagnostics: [
                {
                  code: 'invalid_property',
                  level: 'error',
                  message: 'Property lang is not JSON-serializable.',
                },
              ],
              message: 'The document contains blocks that are not supported yet.',
            },
            ok: false,
          },
          { status: 422 },
        ),
      ),
    )

    await expect(importDocumentationPlatform('https://docs.example.com/guide')).rejects.toThrow(
      'The document contains blocks that are not supported yet.',
    )
  })
})
