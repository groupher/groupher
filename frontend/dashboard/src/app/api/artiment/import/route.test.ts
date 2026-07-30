import { File } from 'node:buffer'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPhoenixToken } from '~/app/phoenix-token'

import { POST } from './route'

const mocks = vi.hoisted(() => ({ importDocumentationUrl: vi.fn() }))

vi.mock('~/app/phoenix-token', () => ({ getPhoenixToken: vi.fn() }))
vi.mock('../../../../lib/document-importer/platform', () => ({
  importDocumentationUrl: mocks.importDocumentationUrl,
}))

const mockedGetPhoenixToken = vi.mocked(getPhoenixToken)

const request = (filename = 'guide.html') => {
  const file = new File(['<h1>Guide</h1>'], filename, { type: 'text/html' })

  return {
    formData: vi.fn().mockResolvedValue({ get: () => file }),
    headers: new Headers({ 'Content-Type': 'multipart/form-data; boundary=test' }),
    method: 'POST',
    url: 'http://localhost/api/artiment/import',
  } as unknown as Request
}

const converterResponse = (markdown: string) =>
  new Response(
    JSON.stringify({
      diagnostics: [],
      markdown,
      source: { filename: 'guide.html', mimeType: 'text/html', sizeBytes: 14 },
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 },
  )

const documentationRequest = (url = 'https://docs.example.com/guide') =>
  new Request('http://localhost/api/artiment/import', {
    body: JSON.stringify({ source: 'documentation-url', url }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('/api/artiment/import', () => {
  beforeEach(() => {
    mockedGetPhoenixToken.mockReset()
    mocks.importDocumentationUrl.mockReset()
    vi.stubEnv('DOCUMENT_CONVERTER_APP_ENDPOINT', 'https://converter.example.test')
    vi.stubGlobal(
      'FormData',
      class {
        set(): void {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requires an authenticated Groupher session', async () => {
    mockedGetPhoenixToken.mockReturnValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('converts the upload and initializes a Plate value through MarkdownKit', async () => {
    mockedGetPhoenixToken.mockReturnValue('backend-token')
    const fetchMock = vi.fn().mockResolvedValue(converterResponse('# Guide\n\nHello **world**'))
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://converter.example.test/convert'),
      expect.objectContaining({ method: 'POST', redirect: 'error' }),
    )
    expect(payload).toMatchObject({
      ok: true,
      result: {
        source: { filename: 'guide.html' },
        value: [
          { children: [{ text: 'Guide' }], type: 'h1' },
          {
            children: [{ text: 'Hello ' }, { bold: true, text: 'world' }],
            type: 'p',
          },
        ],
      },
    })
  })

  it('preserves table nodes after editor support landed', async () => {
    mockedGetPhoenixToken.mockReturnValue('backend-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(converterResponse('| A | B |\n| --- | --- |\n| 1 | 2 |')),
    )

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      result: {
        value: expect.arrayContaining([expect.objectContaining({ type: 'table' })]),
      },
    })
  })

  it('imports a public documentation URL through the Markdown flow', async () => {
    mockedGetPhoenixToken.mockReturnValue('backend-token')
    mocks.importDocumentationUrl.mockResolvedValue({
      diagnostics: [],
      markdown: '# Guide',
      source: {
        filename: 'docs.example.com/guide.md',
        mimeType: 'text/markdown',
        sizeBytes: 7,
      },
      value: [{ children: [{ text: 'Guide' }], type: 'h1' }],
    })

    const response = await POST(documentationRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.importDocumentationUrl).toHaveBeenCalledWith('https://docs.example.com/guide')
    expect(payload).toMatchObject({
      ok: true,
      result: { source: { filename: 'docs.example.com/guide.md' } },
    })
  })

  it('rejects unsupported files before calling the converter', async () => {
    mockedGetPhoenixToken.mockReturnValue('backend-token')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(request('archive.zip'))
    const payload = await response.json()

    expect(response.status).toBe(415)
    expect(payload.error.code).toBe('unsupported_extension')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
