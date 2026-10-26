import { describe, expect, it } from 'vitest'

import worker from './worker'

const env = {
  ALLOWED_ORIGINS: 'https://example.test',
  ENVIRONMENT: 'test',
  MAX_UPLOAD_BYTES: String(1024),
} as Parameters<typeof worker.fetch>[1]

const minimalDocx = Uint8Array.from(
  atob(
    'UEsDBBQAAAAIAKA+WF15bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygUSlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwMEFAAAAAgAoD5YXZv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4IqSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQsFKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIAKA+WF0NcmPg4AAAAFUBAAARAAAAd29yZC9kb2N1bWVudC54bWxtkE1OxDAMha8SZU9TWCBUtR2hQYgdlRgOEBJPW5HYleNO6e3pz2jYsLFlvafPzy4PPzGoC3DqCSt9n+VaATryPbaV/jy93j1plcSit4EQKj1D0oe6nApPboyAohYApmKqdCcyFMYk10G0KaMBcNHOxNHKMnJrJmI/MDlIaeHHYB7y/NFE26NekV/k57UPW2l4ax8yB1BTcbGh0qdeAmhTl+Zm2IrUzftRvYFdc6+ibBbejTfm1fuM8ws55QivhyvpmMa2U8dAoz8Hy8tG4m9gn/1LS+Ck4T3Hntr8faT+BVBLAQIUAxQAAAAIAKA+WF15bjPX6AAAAK0BAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAoD5YXZv9N+qtAAAAKQEAAAsAAAAAAAAAAAAAAIABGQEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAoD5YXQ1yY+DgAAAAVQEAABEAAAAAAAAAAAAAAIAB7wEAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAADAAMAuQAAAP4CAAAAAA==',
  ),
  (character) => character.charCodeAt(0),
)

describe('converter Worker', () => {
  it('serves the renamed health contract from workerd', async () => {
    const response = await worker.fetch(new Request('https://md.test/health'), env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      schemaVersion: 'health.v1',
      service: 'converter',
      environment: 'test',
    })
  })

  it('rejects PDF with the stable unsupported-extension diagnostic', async () => {
    const form = new FormData()
    form.set('file', new File(['%PDF-1.4'], 'example.pdf', { type: 'application/pdf' }))
    const response = await worker.fetch(
      new Request('https://md.test/convert', { method: 'POST', body: form }),
      env,
    )

    expect(response.status).toBe(415)
    expect(await response.json()).toMatchObject({
      diagnostics: [{ code: 'unsupported_extension', level: 'error' }],
    })
  })

  it.each(['example.html', 'example.htm'])(
    'rejects uploaded HTML (%s) without conversion',
    async (filename) => {
      const form = new FormData()
      form.set('file', new File(['<h1>Page</h1>'], filename, { type: 'text/html' }))
      const response = await worker.fetch(
        new Request('https://md.test/convert', { method: 'POST', body: form }),
        env,
      )

      expect(response.status).toBe(415)
      expect(await response.json()).toMatchObject({
        diagnostics: [{ code: 'unsupported_extension', level: 'error' }],
      })
    },
  )

  it('rejects malformed OOXML and stays healthy for the next request', async () => {
    const form = new FormData()
    form.set(
      'file',
      new File(['not a zip archive'], 'broken.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )
    const response = await worker.fetch(
      new Request('https://md.test/convert', { method: 'POST', body: form }),
      env,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      diagnostics: [{ code: 'invalid_file_content', level: 'error' }],
    })
    expect((await worker.fetch(new Request('https://md.test/health'), env)).status).toBe(200)
  })

  it('rejects an upload above the configured limit before conversion', async () => {
    const form = new FormData()
    form.set(
      'file',
      new File([new Uint8Array(2 * 1024)], 'oversized.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )
    const response = await worker.fetch(
      new Request('https://md.test/convert', { method: 'POST', body: form }),
      env,
    )

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({
      diagnostics: [{ code: 'file_too_large', level: 'error' }],
    })
  })

  it('rejects a multipart request with no file field', async () => {
    const form = new FormData()
    form.set('other', 'value')
    const response = await worker.fetch(
      new Request('https://md.test/convert', { method: 'POST', body: form }),
      env,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      diagnostics: [{ code: 'invalid_request', level: 'error' }],
    })
  })

  it('converts a DOCX fixture in the Cloudflare runtime', async () => {
    const form = new FormData()
    form.set(
      'file',
      new File([minimalDocx], 'sample.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )
    const response = await worker.fetch(
      new Request('https://md.test/convert', { method: 'POST', body: form }),
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      markdown: 'POC Heading\n\nAnyDoc conversion through Cloudflare workerd.\n',
      source: { filename: 'sample.docx', sizeBytes: minimalDocx.byteLength },
      diagnostics: [],
    })
  })

  it('rejects an unapproved browser origin', async () => {
    const form = new FormData()
    form.set(
      'file',
      new File(['data'], 'example.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )
    const response = await worker.fetch(
      new Request('https://md.test/convert', {
        method: 'POST',
        body: form,
        headers: { origin: 'https://attacker.test' },
      }),
      env,
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      diagnostics: [{ code: 'origin_not_allowed' }],
    })
  })
})
