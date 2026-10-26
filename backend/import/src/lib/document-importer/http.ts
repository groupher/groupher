/**
 * Single-document Import Content orchestration.
 *
 * uploaded file -> converter -> Markdown --+
 *                                                   +-> shared Markdown codec -> Plate value
 * public docs URL -> bounded Markdown fetch --------+
 *
 * GitHub Docs Bulk Import already owns Markdown source files and enters at the
 * shared codec/publisher boundary rather than calling this HTTP handler.
 *
 * @see docs/import/article-publish-import-refactor.md
 */
import { Buffer } from 'node:buffer'

import { DocumentImporterError } from './error'
import { deserializeMarkdown } from './markdown'
import type {
  TDocumentImportDiagnostic,
  TDocumentImportErrorPayload,
  TDocumentImportResult,
  TDocumentImportSource,
} from './types'

export const DOCUMENT_IMPORT_MAX_FILE_BYTES = 25 * 1024 * 1024
const DOCUMENT_IMPORT_MAX_REQUEST_BYTES = DOCUMENT_IMPORT_MAX_FILE_BYTES + 1024 * 1024
const DOCUMENT_CONVERTER_TIMEOUT_MS = 60_000
const ALLOWED_EXTENSIONS = new Set(['.docx', '.pptx', '.xlsx'])
const DOCUMENT_IMPORT_MAX_JSON_BYTES = 8 * 1024

type TDocumentImporterOptions = {
  converterEndpoint?: string
  importDocumentationUrl?: (rawUrl: string) => Promise<TDocumentImportResult>
}

const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), { headers: responseHeaders, status })

const errorResponse = (error: DocumentImporterError): Response => {
  const payload: TDocumentImportErrorPayload = {
    code: error.code,
    message: error.message,
    ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}),
  }

  return jsonResponse({ error: payload, ok: false }, error.status)
}

const getExtension = (filename: string): string => {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex < 0 ? '' : filename.slice(dotIndex).toLowerCase()
}

const readDocumentationUrl = async (request: Request): Promise<string> => {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > DOCUMENT_IMPORT_MAX_JSON_BYTES) {
    throw new DocumentImporterError('payload_too_large', 'The import request is too large.', {
      status: 413,
    })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    throw new DocumentImporterError('invalid_request', 'Unable to read the import request.', {
      status: 400,
    })
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new DocumentImporterError('invalid_request', 'A documentation URL is required.', {
      status: 422,
    })
  }

  const { source, url } = payload as Record<string, unknown>
  if (source !== 'documentation-url' || typeof url !== 'string' || !url.trim()) {
    throw new DocumentImporterError('invalid_request', 'A documentation URL is required.', {
      status: 422,
    })
  }

  return url
}

const readFile = async (request: Request): Promise<File> => {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('multipart/form-data')) {
    throw new DocumentImporterError(
      'unsupported_media_type',
      'Content-Type must be multipart/form-data.',
      { status: 415 },
    )
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > DOCUMENT_IMPORT_MAX_REQUEST_BYTES) {
    throw new DocumentImporterError('payload_too_large', 'The selected file is too large.', {
      status: 413,
    })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new DocumentImporterError('invalid_request', 'Unable to read the uploaded file.', {
      status: 400,
    })
  }

  const file = formData.get('file')
  if (
    typeof file === 'string' ||
    !file ||
    typeof file.name !== 'string' ||
    typeof file.size !== 'number' ||
    typeof file.stream !== 'function'
  ) {
    throw new DocumentImporterError(
      'invalid_request',
      "A multipart file field named 'file' is required.",
      { status: 422 },
    )
  }

  const uploadedFile = file as File

  if (Buffer.byteLength(uploadedFile.name, 'utf8') > 255) {
    throw new DocumentImporterError('invalid_filename', 'The selected filename is too long.', {
      status: 400,
    })
  }

  if (!ALLOWED_EXTENSIONS.has(getExtension(uploadedFile.name))) {
    throw new DocumentImporterError(
      'unsupported_extension',
      'Supported formats are DOCX, PPTX, and XLSX.',
      { status: 415 },
    )
  }

  if (uploadedFile.size > DOCUMENT_IMPORT_MAX_FILE_BYTES) {
    throw new DocumentImporterError('payload_too_large', 'The selected file is too large.', {
      status: 413,
    })
  }

  return uploadedFile
}

const getConverterUrl = (converterEndpoint?: string): URL => {
  const configuredUrl =
    converterEndpoint?.trim() || process.env.DOCUMENT_CONVERTER_APP_ENDPOINT?.trim()
  if (!configuredUrl) {
    throw new DocumentImporterError(
      'converter_unavailable',
      'Document converter is not configured.',
      { status: 503 },
    )
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(configuredUrl)
  } catch {
    throw new DocumentImporterError(
      'converter_unavailable',
      'Document converter is not configured correctly.',
      { status: 503 },
    )
  }

  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new DocumentImporterError(
      'converter_unavailable',
      'Document converter is not configured correctly.',
      { status: 503 },
    )
  }

  return new URL('convert', `${baseUrl.toString().replace(/\/$/, '')}/`)
}

const isDiagnostic = (value: unknown): value is TDocumentImportDiagnostic => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const diagnostic = value as Partial<TDocumentImportDiagnostic>
  return (
    (diagnostic.level === 'warning' || diagnostic.level === 'error') &&
    typeof diagnostic.code === 'string' &&
    typeof diagnostic.message === 'string'
  )
}

const readDiagnostics = (value: unknown): TDocumentImportDiagnostic[] =>
  Array.isArray(value) ? value.filter(isDiagnostic) : []

const readSource = (value: unknown): TDocumentImportSource => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DocumentImporterError(
      'invalid_converter_response',
      'Document converter returned invalid source metadata.',
      { status: 502 },
    )
  }

  const source = value as Partial<TDocumentImportSource>
  if (
    typeof source.filename !== 'string' ||
    typeof source.mimeType !== 'string' ||
    typeof source.sizeBytes !== 'number' ||
    !Number.isFinite(source.sizeBytes)
  ) {
    throw new DocumentImporterError(
      'invalid_converter_response',
      'Document converter returned invalid source metadata.',
      { status: 502 },
    )
  }

  return source as TDocumentImportSource
}

const convertFile = async (
  file: File,
  converterEndpoint?: string,
): Promise<TDocumentImportResult> => {
  const formData = new FormData()
  formData.set('file', file, file.name)

  let response: Response
  try {
    response = await fetch(getConverterUrl(converterEndpoint), {
      body: formData,
      method: 'POST',
      // workerd accepts only follow/manual; a 3xx is rejected below as non-ok.
      redirect: 'manual',
      signal: AbortSignal.timeout(DOCUMENT_CONVERTER_TIMEOUT_MS),
    })
  } catch {
    throw new DocumentImporterError(
      'converter_unavailable',
      'Document converter could not be reached.',
      { status: 502 },
    )
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const diagnostics = readDiagnostics(payload?.diagnostics)
    throw new DocumentImporterError(
      diagnostics[0]?.code ?? 'conversion_failed',
      diagnostics[0]?.message ?? 'Document conversion failed.',
      {
        diagnostics,
        status: response.status >= 400 && response.status < 500 ? response.status : 502,
      },
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new DocumentImporterError(
      'invalid_converter_response',
      'Document converter returned an invalid response.',
      { status: 502 },
    )
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new DocumentImporterError(
      'invalid_converter_response',
      'Document converter returned an invalid response.',
      { status: 502 },
    )
  }

  const converterPayload = payload as Record<string, unknown>
  const diagnostics = readDiagnostics(converterPayload.diagnostics)
  const markdown = converterPayload.markdown
  const value = deserializeMarkdown(markdown)

  return {
    diagnostics,
    markdown: markdown as string,
    source: readSource(converterPayload.source),
    value,
  }
}

/** Routes a bounded upload or documentation URL through the single-document import pipeline. */
export const handleDocumentImportRequest = async (
  request: Request,
  options: TDocumentImporterOptions = {},
): Promise<Response> => {
  try {
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
    if (contentType.includes('application/json')) {
      const url = await readDocumentationUrl(request)
      if (!options.importDocumentationUrl) {
        throw new DocumentImporterError(
          'service_unavailable',
          'Documentation URL import is not configured for this runtime.',
          { status: 503 },
        )
      }
      const result = await options.importDocumentationUrl(url)

      return jsonResponse({ ok: true, result })
    }

    const file = await readFile(request)
    const result = await convertFile(file, options.converterEndpoint)

    return jsonResponse({ ok: true, result })
  } catch (error) {
    if (error instanceof DocumentImporterError) return errorResponse(error)

    return jsonResponse(
      {
        error: { code: 'internal_error', message: 'Failed to import the document.' },
        ok: false,
      },
      500,
    )
  }
}
