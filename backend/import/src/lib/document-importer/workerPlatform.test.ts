import { describe, expect, it, vi } from 'vitest'

import { DocumentImporterError } from './error'
import { importDocumentationUrlOnWorker } from './workerPlatform'

describe('importDocumentationUrlOnWorker', () => {
  it('accepts Markdown from the original URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('# Guide\n\nHello from Markdown.', {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      }),
    )

    const result = await importDocumentationUrlOnWorker('https://docs.example/guide', fetcher)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ Accept: 'text/markdown' })
    expect(result.markdown).toContain('Hello from Markdown.')
  })

  it('tries the .md path when the original page does not return Markdown', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('<html>page</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('# Guide\n\nMarkdown endpoint.', {
          headers: { 'Content-Type': 'text/plain' },
        }),
      )

    const result = await importDocumentationUrlOnWorker('https://docs.example/guide', fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(String(fetcher.mock.calls[1]?.[0])).toBe('https://docs.example/guide.md')
    expect(result.markdown).toContain('Markdown endpoint.')
  })

  it('rejects when both probes return HTML', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('<html>page</html>', { headers: { 'Content-Type': 'text/html' } }),
      )

    await expect(
      importDocumentationUrlOnWorker('https://docs.example/guide', fetcher),
    ).rejects.toMatchObject({ code: 'unsupported_source', status: 422 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('revalidates redirects before following them', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { headers: { Location: 'http://127.0.0.1/admin' }, status: 302 }),
      )

    await expect(
      importDocumentationUrlOnWorker('https://docs.example/guide', fetcher),
    ).rejects.toMatchObject({ code: 'invalid_url' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects non-HTTPS and trailing-dot localhost URLs', async () => {
    const fetcher = vi.fn<typeof fetch>()

    await expect(
      importDocumentationUrlOnWorker('http://docs.example/guide', fetcher),
    ).rejects.toBeInstanceOf(DocumentImporterError)
    await expect(
      importDocumentationUrlOnWorker('https://localhost./guide', fetcher),
    ).rejects.toMatchObject({
      code: 'invalid_url',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
