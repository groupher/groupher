/**
 * Worker-specific URL probing and bounded Markdown response handling.
 *
 * public URL -> Cloudflare egress guard + redirect checks -> Markdown probes
 *             -> validated Markdown result
 *
 * This adapter rejects IP literals, local hostnames, and unsafe redirect targets
 * before each fetch. It does not resolve or pin DNS addresses, so public hostnames
 * that resolve to private addresses are outside this application's validation.
 */
import { DocumentImporterError } from './error'
import { deserializeMarkdownResult } from './markdown'
import type { TDocumentImportResult } from './types'

const DOCUMENTATION_FETCH_TIMEOUT_MS = 15_000
const DOCUMENTATION_MAX_BYTES = 5 * 1024 * 1024
const DOCUMENTATION_MAX_REDIRECTS = 3
const MINTLIFY_MARKDOWN_PATTERN = /<(?:AccordionGroup|Steps)\b/
const INTERNAL_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa']

const parseDocumentationUrl = (rawUrl: string, appendMarkdownSuffix: boolean): URL => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new DocumentImporterError('invalid_url', 'Enter a valid documentation URL.', {
      status: 422,
    })
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/u, '')
  const isIpLiteral = /^[0-9.]+$/u.test(hostname) || hostname.includes(':')
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !hostname ||
    isIpLiteral ||
    hostname === 'localhost' ||
    INTERNAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new DocumentImporterError(
      'invalid_url',
      'Documentation imports require a public HTTPS URL.',
      { status: 422 },
    )
  }

  if (appendMarkdownSuffix && !url.pathname.toLowerCase().endsWith('.md')) {
    url.pathname = `${url.pathname.replace(/\/$/u, '')}.md`
  }
  url.hash = ''
  return url
}

const readBoundedMarkdown = async (response: Response): Promise<string> => {
  const rawLength = response.headers.get('content-length')
  const declaredLength = rawLength ? Number(rawLength) : undefined
  if (
    declaredLength !== undefined &&
    Number.isFinite(declaredLength) &&
    declaredLength > DOCUMENTATION_MAX_BYTES
  ) {
    await response.body?.cancel()
    throw new DocumentImporterError('payload_too_large', 'The documentation page is too large.', {
      status: 413,
    })
  }

  if (!response.ok) {
    await response.body?.cancel()
    throw new DocumentImporterError(
      'unsupported_source',
      'This documentation page does not expose Markdown content.',
      { status: 422 },
    )
  }
  const mimeType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!mimeType.includes('text/markdown') && !mimeType.includes('text/plain')) {
    await response.body?.cancel()
    throw new DocumentImporterError(
      'unsupported_source',
      'This documentation page did not return a Markdown-compatible content type.',
      { status: 422 },
    )
  }
  if (!response.body) {
    throw new DocumentImporterError('unsupported_source', 'The Markdown response was empty.', {
      status: 422,
    })
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > DOCUMENTATION_MAX_BYTES) {
        await reader.cancel()
        throw new DocumentImporterError(
          'payload_too_large',
          'The documentation page is too large.',
          { status: 413 },
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  if (size === 0) {
    throw new DocumentImporterError('unsupported_source', 'The Markdown response was empty.', {
      status: 422,
    })
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

const fetchMarkdown = async (
  initialUrl: URL,
  fetcher: typeof fetch,
): Promise<{ markdown: string; response: Response; url: URL }> => {
  let url = new URL(initialUrl)
  for (let redirects = 0; redirects <= DOCUMENTATION_MAX_REDIRECTS; redirects += 1) {
    let response: Response
    try {
      response = await fetcher(url, {
        headers: { Accept: 'text/markdown' },
        redirect: 'manual',
        signal: AbortSignal.timeout(DOCUMENTATION_FETCH_TIMEOUT_MS),
      })
    } catch {
      throw new DocumentImporterError(
        'source_unavailable',
        'The documentation page could not be fetched.',
        {
          status: 422,
        },
      )
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location || redirects === DOCUMENTATION_MAX_REDIRECTS) {
        throw new DocumentImporterError(
          'source_unavailable',
          'The documentation page redirected too many times.',
          { status: 422 },
        )
      }
      try {
        url = parseDocumentationUrl(new URL(location, url).toString(), false)
      } catch (error) {
        if (error instanceof DocumentImporterError) throw error
        throw new DocumentImporterError(
          'source_unavailable',
          'The documentation page returned an invalid redirect.',
          { status: 422 },
        )
      }
      continue
    }

    const markdown = await readBoundedMarkdown(response)
    return { markdown, response, url }
  }
  throw new DocumentImporterError('source_unavailable', 'The documentation page is unavailable.', {
    status: 422,
  })
}

/** Probes the supplied URL, then its `.md` path; HTML responses are never converted. */
export const importDocumentationUrlOnWorker = async (
  rawUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<TDocumentImportResult> => {
  const originalUrl = parseDocumentationUrl(rawUrl.trim(), false)
  const markdownUrl = parseDocumentationUrl(originalUrl.toString(), true)
  const candidates =
    originalUrl.toString() === markdownUrl.toString() ? [originalUrl] : [originalUrl, markdownUrl]
  let lastError: DocumentImporterError | undefined

  for (const candidate of candidates) {
    try {
      const { markdown, response, url } = await fetchMarkdown(candidate, fetcher)
      const matchedPath = response.headers.get('x-matched-path')?.toLowerCase() ?? ''
      const imported = deserializeMarkdownResult(markdown, {
        source:
          matchedPath.includes('/_mintlify/') || MINTLIFY_MARKDOWN_PATTERN.test(markdown)
            ? 'mintlify'
            : 'groupher',
      })
      return {
        diagnostics: imported.diagnostics.map(({ severity, ...diagnostic }) => ({
          ...diagnostic,
          level: severity,
        })),
        markdown,
        source: {
          filename: `${url.hostname}${url.pathname}`,
          mimeType: response.headers.get('content-type') ?? 'text/markdown',
          sizeBytes: new TextEncoder().encode(markdown).byteLength,
        },
        value: imported.value,
      }
    } catch (error) {
      if (!(error instanceof DocumentImporterError)) throw error
      if (!['unsupported_source', 'source_unavailable'].includes(error.code)) throw error
      lastError = error
    }
  }

  throw (
    lastError ??
    new DocumentImporterError(
      'unsupported_source',
      'This documentation page does not expose Markdown content.',
      { status: 422 },
    )
  )
}
