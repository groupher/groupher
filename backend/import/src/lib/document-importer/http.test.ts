/**
 * Verifies the upload-to-converter HTTP boundary.
 *
 * multipart upload -> converter request -> Markdown result
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { handleDocumentImportRequest } from './http'

describe('handleDocumentImportRequest', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('forwards an upload using the workerd-compatible redirect policy', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        diagnostics: [],
        markdown: '# Imported guide',
        source: {
          filename: 'guide.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 4,
        },
      }),
    )
    vi.stubGlobal('fetch', fetcher)

    const form = new FormData()
    form.set('file', new Blob(['docx']), 'guide.docx')
    const response = await handleDocumentImportRequest(
      new Request('https://content-import.example.test/api/artiment/import', {
        body: form,
        method: 'POST',
      }),
      {
        converterEndpoint: 'https://converter.example.test',
      },
    )

    expect(response.status).toBe(200)
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('manual')
    expect(fetcher.mock.calls[0]?.[1]?.headers).toBeUndefined()
  })

  it('rejects converter redirects without following them', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://other.example.test' } }),
      )
    vi.stubGlobal('fetch', fetcher)
    const form = new FormData()
    form.set('file', new Blob(['docx']), 'guide.docx')
    const response = await handleDocumentImportRequest(
      new Request('https://content-import.example.test/api/artiment/import', {
        body: form,
        method: 'POST',
      }),
      { converterEndpoint: 'https://converter.example.test' },
    )
    expect(response.status).toBe(502)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('manual')
  })
})
