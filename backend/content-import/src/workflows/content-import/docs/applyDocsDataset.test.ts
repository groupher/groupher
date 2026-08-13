import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  failDocImport: vi.fn(),
  runPreviewDocBulkImport: vi.fn(),
}))

vi.mock('../../../lib/content-import/core/preview-store', () => ({
  getPreviewStore: () => ({}),
}))
vi.mock('../../../lib/content-import/threads/docs/publisher', () => ({
  runPreviewDocBulkImport: mocks.runPreviewDocBulkImport,
}))
vi.mock('../../../lib/content-import/transport/phoenix/docsImport', () => ({
  failDocImport: mocks.failDocImport,
}))

import { applyDocsDataset } from './applyDocsDataset'

describe('applyDocsDataset failure projection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.failDocImport.mockResolvedValue(undefined)
  })

  it('keeps a structured workflow error message when the cause is not an Error instance', async () => {
    const cause = { message: 'duplicate key value violates unique constraint' }
    mocks.runPreviewDocBulkImport.mockRejectedValue(cause)

    await expect(
      applyDocsDataset({
        attemptRef: 'attempt-1',
        community: 'home',
        jobRef: 'job-1',
        previewRef: 'preview-1',
        sourceRefs: ['docs/start.md'],
      }),
    ).rejects.toBe(cause)

    expect(mocks.failDocImport).toHaveBeenCalledWith(
      'home',
      'job-1',
      'doc_import_workflow_failed',
      cause.message,
      { serviceSubject: 'service:content-import' },
    )
  })
})
