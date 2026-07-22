import { describe, expect, it, vi } from 'vitest'

import { DocumentImporterError } from './error'
import { importDocumentationUrl } from './platform'

const publicAddresses = async () => [{ address: '93.184.216.34', family: 4 as const }]

describe('importDocumentationUrl', () => {
  it('adds the Markdown suffix and initializes an editor value', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('# Guide\n\nHello **world**', {
          headers: { 'Content-Type': 'text/markdown' },
        }),
    )

    const result = await importDocumentationUrl('https://docs.example.com/guide', {
      fetchImpl,
      resolveImpl: publicAddresses,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://docs.example.com/guide.md'),
      expect.objectContaining({ redirect: 'manual' }),
    )
    expect(result).toMatchObject({
      markdown: '# Guide\n\nHello **world**',
      source: {
        filename: 'docs.example.com/guide.md',
        mimeType: 'text/markdown',
      },
      value: [
        { children: [{ text: 'Guide' }], type: 'h1' },
        { children: [{ text: 'Hello ' }, { bold: true, text: 'world' }], type: 'p' },
      ],
    })
  })

  it('detects Mintlify MDX and preserves structural Markdown blocks', async () => {
    const markdown = `<Steps>
  <Step title="Configure DNS">
    | Type | Value |
    | --- | --- |
    | A | 192.0.2.1 |
  </Step>
</Steps>`

    const result = await importDocumentationUrl('https://docs.example.com/dns.md', {
      fetchImpl: async () =>
        new Response(markdown, {
          headers: {
            'Content-Type': 'text/markdown',
          },
        }),
      resolveImpl: publicAddresses,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.value).toEqual([
      {
        children: [{ text: 'Configure DNS' }],
        type: 'h3',
      },
      expect.objectContaining({ type: 'table' }),
    ])
  })

  it('rejects URLs that resolve to private addresses before fetching', async () => {
    const fetchImpl = vi.fn()

    await expect(
      importDocumentationUrl('https://docs.example.com/guide', {
        fetchImpl,
        resolveImpl: async () => [{ address: '127.0.0.1', family: 4 }],
      }),
    ).rejects.toMatchObject({ code: 'private_source' } satisfies Partial<DocumentImporterError>)

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('revalidates the destination of every redirect', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          headers: { Location: 'https://internal.example.test/secret' },
          status: 302,
        }),
    )

    await expect(
      importDocumentationUrl('https://docs.example.com/guide', {
        fetchImpl,
        resolveImpl: async (hostname) =>
          hostname === 'internal.example.test'
            ? [{ address: '10.0.0.8', family: 4 }]
            : [{ address: '93.184.216.34', family: 4 }],
      }),
    ).rejects.toMatchObject({ code: 'private_source' } satisfies Partial<DocumentImporterError>)

    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('rejects HTML responses instead of previewing an error page', async () => {
    await expect(
      importDocumentationUrl('https://docs.example.com/guide', {
        fetchImpl: async () =>
          new Response('<html>Not Markdown</html>', {
            headers: { 'Content-Type': 'text/html' },
          }),
        resolveImpl: publicAddresses,
      }),
    ).rejects.toMatchObject({ code: 'unsupported_source' } satisfies Partial<DocumentImporterError>)
  })
})
