/**
 * Imports one public documentation page as Markdown with SSRF-safe DNS pinning.
 *
 *   public URL -> DNS/redirect safety -> bounded fetch -> Markdown deserializer
 *
 * @see docs/bulk-import/article-publish-import-refactor.md
 */
import { Buffer } from 'node:buffer'
import type { LookupAddress } from 'node:dns'
import { lookup as resolveHostname } from 'node:dns/promises'
import { BlockList, isIP, type LookupFunction } from 'node:net'

import { Agent, fetch as undiciFetch, type RequestInit } from 'undici'

import { DocumentImporterError } from './error'
import { deserializeMarkdownResult } from './markdown'
import type { TDocumentImportResult } from './types'

const DOCUMENTATION_FETCH_TIMEOUT_MS = 15_000
const DOCUMENTATION_MAX_BYTES = 5 * 1024 * 1024
const DOCUMENTATION_MAX_REDIRECTS = 3
const MINTLIFY_MARKDOWN_PATTERN = /<(?:AccordionGroup|Steps)\b/

const blockedAddresses = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4')
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6')
}

type TPlatformResponse = Pick<Response, 'body' | 'headers' | 'ok' | 'status' | 'text'>
type TFetch = (url: string | URL, init?: RequestInit) => Promise<TPlatformResponse>

type TOptions = {
  fetchImpl?: TFetch
  resolveImpl?: (hostname: string) => Promise<LookupAddress[]>
}

const normalizeHostname = (hostname: string): string => hostname.replace(/^\[|\]$/g, '')

const isPublicAddress = ({ address, family }: LookupAddress): boolean =>
  !address.toLowerCase().startsWith('::ffff:') &&
  !blockedAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6')

const parseDocumentationUrl = (rawUrl: string, appendMarkdownSuffix: boolean): URL => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new DocumentImporterError('invalid_url', 'Enter a valid documentation URL.', {
      status: 422,
    })
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  ) {
    throw new DocumentImporterError(
      'invalid_url',
      'Documentation imports require a public HTTPS URL.',
      { status: 422 },
    )
  }

  if (appendMarkdownSuffix && !url.pathname.toLowerCase().endsWith('.md')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}.md`
  }

  return url
}

const resolvePublicAddresses = async (
  url: URL,
  resolveImpl: NonNullable<TOptions['resolveImpl']>,
): Promise<LookupAddress[]> => {
  const hostname = normalizeHostname(url.hostname)
  const literalFamily = isIP(hostname)

  let addresses: LookupAddress[]
  try {
    addresses = literalFamily
      ? [{ address: hostname, family: literalFamily }]
      : await resolveImpl(hostname)
  } catch {
    throw new DocumentImporterError('source_unavailable', 'The documentation site was not found.', {
      status: 422,
    })
  }

  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
    throw new DocumentImporterError(
      'private_source',
      'The documentation URL must resolve to a public address.',
      { status: 422 },
    )
  }

  return addresses
}

const createPinnedDispatcher = (addresses: LookupAddress[]): Agent => {
  const lookup: LookupFunction = (_hostname, _options, callback) => callback(null, addresses)

  return new Agent({
    connect: { lookup },
    connectTimeout: DOCUMENTATION_FETCH_TIMEOUT_MS,
    maxResponseSize: DOCUMENTATION_MAX_BYTES,
  })
}

const readMarkdownResponse = async (response: TPlatformResponse): Promise<string> => {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > DOCUMENTATION_MAX_BYTES) {
    throw new DocumentImporterError('payload_too_large', 'The documentation page is too large.', {
      status: 413,
    })
  }

  if (!response.ok) {
    throw new DocumentImporterError(
      'source_unavailable',
      'The documentation page could not be fetched as Markdown.',
      { status: 422 },
    )
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('text/html')) {
    throw new DocumentImporterError(
      'unsupported_source',
      'This documentation page does not expose Markdown content.',
      { status: 422 },
    )
  }

  const markdown = await response.text()
  if (Buffer.byteLength(markdown, 'utf8') > DOCUMENTATION_MAX_BYTES) {
    throw new DocumentImporterError('payload_too_large', 'The documentation page is too large.', {
      status: 413,
    })
  }

  return markdown
}

const isMintlifyMarkdown = (response: TPlatformResponse, markdown: string): boolean => {
  const matchedPath = response.headers.get('x-matched-path')?.toLowerCase() ?? ''

  return matchedPath.includes('/_mintlify/') || MINTLIFY_MARKDOWN_PATTERN.test(markdown)
}

/** Fetches one bounded public HTTPS Markdown page and returns its validated Plate value. */
export const importDocumentationUrl = async (
  rawUrl: string,
  options: TOptions = {},
): Promise<TDocumentImportResult> => {
  const fetchImpl = options.fetchImpl ?? (undiciFetch as unknown as TFetch)
  const resolveImpl =
    options.resolveImpl ??
    ((hostname: string) => resolveHostname(hostname, { all: true, verbatim: true }))
  let url = parseDocumentationUrl(rawUrl.trim(), true)

  for (let redirectCount = 0; redirectCount <= DOCUMENTATION_MAX_REDIRECTS; redirectCount += 1) {
    const addresses = await resolvePublicAddresses(url, resolveImpl)
    const dispatcher = createPinnedDispatcher(addresses)

    try {
      const response = await fetchImpl(url, {
        dispatcher,
        headers: { Accept: 'text/markdown, text/plain;q=0.9' },
        redirect: 'manual',
        signal: AbortSignal.timeout(DOCUMENTATION_FETCH_TIMEOUT_MS),
      })

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location || redirectCount === DOCUMENTATION_MAX_REDIRECTS) {
          throw new DocumentImporterError(
            'source_unavailable',
            'The documentation page redirected too many times.',
            { status: 422 },
          )
        }

        url = parseDocumentationUrl(new URL(location, url).toString(), false)
        continue
      }

      const markdown = await readMarkdownResponse(response)
      const imported = deserializeMarkdownResult(markdown, {
        source: isMintlifyMarkdown(response, markdown) ? 'mintlify' : 'groupher',
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
          sizeBytes: Buffer.byteLength(markdown, 'utf8'),
        },
        value: imported.value,
      }
    } catch (error) {
      if (error instanceof DocumentImporterError) throw error
      throw new DocumentImporterError(
        'source_unavailable',
        'The documentation page could not be fetched.',
        { status: 422 },
      )
    } finally {
      await dispatcher.close()
    }
  }

  throw new DocumentImporterError('source_unavailable', 'The documentation page is unavailable.', {
    status: 422,
  })
}
