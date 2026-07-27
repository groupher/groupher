import { describe, expect, it } from 'vitest'

import FilesPreviewStore from './filesPreviewStore'
import { createPreviewStore } from './store'

describe('createPreviewStore', () => {
  it('uses the Files SDK fs adapter for local and CI runtimes', () => {
    expect(createPreviewStore({}, '/tmp/content-import-test')).toBeInstanceOf(FilesPreviewStore)
    expect(
      createPreviewStore({ CI: 'true', VERCEL: '1', DOCS_IMPORT_PREVIEW_STORE: 'local' }),
    ).toBeInstanceOf(FilesPreviewStore)
  })

  it('rejects an implicit local fallback in production', () => {
    expect(() => createPreviewStore({ NODE_ENV: 'production' })).toThrow(
      'DOCS_IMPORT_PREVIEW_STORE is required',
    )
  })

  it('rejects the removed blob compatibility name', () => {
    expect(() => createPreviewStore({ DOCS_IMPORT_PREVIEW_STORE: 'blob' })).toThrow(
      'local" or "vercel-blob',
    )
  })
})
