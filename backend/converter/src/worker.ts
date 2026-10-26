/**
 * Converter Cloudflare runtime boundary.
 *
 * multipart upload -> bounded validation -> AnyDoc WASM -> Markdown
 */
import initSync, { formatFromBytes, toMarkdownBytes } from '@firecrawl/anydoc-wasm'
import wasmModule from '@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm'
import {
  MaxFileSizeExceededError,
  isMultipartRequest,
  parseMultipartRequest,
} from '@mjackson/multipart-parser'

initSync(wasmModule)

type Env = {
  ALLOWED_ORIGINS: string
  ENVIRONMENT: string
  MAX_UPLOAD_BYTES: string
}

type TDiagnostic = {
  level: 'error' | 'warning'
  code: string
  message: string
}

const MIME_BY_EXTENSION: Record<string, Set<string>> = {
  '.docx': new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  ]),
  '.pptx': new Set([
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream',
  ]),
  '.xlsx': new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ]),
}

const ERROR_STATUS: Record<string, number> = {
  empty_file: 400,
  encrypted: 422,
  file_too_large: 413,
  invalid_file_content: 422,
  invalid_filename: 400,
  invalid_request: 422,
  missing_filename: 400,
  missing_mime_type: 415,
  mime_type_mismatch: 415,
  not_found: 404,
  origin_not_allowed: 403,
  processing_limit_exceeded: 413,
  unsupported_extension: 415,
  method_not_allowed: 405,
  conversion_failed: 422,
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })

const failure = (code: string, message: string, status = ERROR_STATUS[code] ?? 422) =>
  json({ diagnostics: [{ level: 'error', code, message } satisfies TDiagnostic] }, status)

const maxUploadBytes = (env: Env) => {
  const configured = Number.parseInt(env.MAX_UPLOAD_BYTES, 10)
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 25 * 1024 * 1024
}

const allowedOrigins = (env: Env) =>
  new Set(
    env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )

const filenameExtension = (filename: string) => {
  const dot = filename.lastIndexOf('.')
  return dot < 0 ? '' : filename.slice(dot).toLowerCase()
}

const validateFilename = (filename: string | undefined): string | TDiagnostic => {
  if (!filename) {
    return { level: 'error', code: 'missing_filename', message: 'A filename is required.' }
  }
  if (filename.includes('\0') || filename.includes('/') || filename.includes('\\')) {
    return {
      level: 'error',
      code: 'invalid_filename',
      message: 'The filename must not contain a path.',
    }
  }
  return filename
}

const convert = async (request: Request, env: Env) => {
  const origin = request.headers.get('origin')
  const origins = allowedOrigins(env)
  if (origin && origins.size > 0 && !origins.has(origin)) {
    return failure('origin_not_allowed', 'The request origin is not allowed.')
  }

  const maxBytes = maxUploadBytes(env)
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes + 64 * 1024) {
    return failure('file_too_large', `The file exceeds the ${maxBytes}-byte upload limit.`)
  }

  if (!isMultipartRequest(request)) {
    return failure('invalid_request', "A multipart file field named 'file' is required.")
  }

  let upload: { filename?: string; mediaType?: string; bytes: Uint8Array } | undefined
  try {
    for await (const part of parseMultipartRequest(request, { maxFileSize: maxBytes })) {
      if (!part.isFile || part.name !== 'file' || upload) {
        return failure('invalid_request', "A single multipart file field named 'file' is required.")
      }
      upload = { filename: part.filename, mediaType: part.mediaType, bytes: part.bytes }
    }
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError) {
      return failure('file_too_large', `The file exceeds the ${maxBytes}-byte upload limit.`)
    }
    return failure('invalid_request', "A multipart file field named 'file' is required.")
  }

  if (!upload) return failure('invalid_request', "A multipart file field named 'file' is required.")

  const safeFilename = validateFilename(upload.filename)
  if (typeof safeFilename !== 'string') return failure(safeFilename.code, safeFilename.message)

  const extension = filenameExtension(safeFilename)
  const allowedMimeTypes = MIME_BY_EXTENSION[extension]
  if (!allowedMimeTypes) {
    return failure(
      'unsupported_extension',
      `Unsupported file extension: ${extension || '(none)'}. No conversion was attempted.`,
    )
  }

  const mimeType = (upload.mediaType || '').split(';', 1)[0].trim().toLowerCase()
  if (!mimeType) return failure('missing_mime_type', 'A MIME type is required.')
  if (!allowedMimeTypes.has(mimeType)) {
    return failure('mime_type_mismatch', `MIME type ${mimeType} does not match ${extension}.`)
  }

  if (upload.bytes.byteLength === 0)
    return failure('empty_file', 'The uploaded file is empty.', 400)
  if (upload.bytes.byteLength > maxBytes) {
    return failure('file_too_large', `The file exceeds the ${maxBytes}-byte upload limit.`)
  }

  try {
    const bytes = upload.bytes
    const format = formatFromBytes(bytes)
    if (format !== extension.slice(1)) {
      return failure(
        'invalid_file_content',
        `The uploaded file is not a valid ${extension} document.`,
      )
    }

    const markdown = toMarkdownBytes(bytes, format)
    const diagnostics: TDiagnostic[] =
      mimeType === 'application/octet-stream'
        ? [
            {
              level: 'warning',
              code: 'generic_mime_type',
              message:
                'The client sent a generic MIME type; the extension and file content were used.',
            },
          ]
        : []
    return json({
      diagnostics,
      markdown,
      source: { filename: safeFilename, mimeType, sizeBytes: bytes.byteLength },
    })
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'encrypted') return failure('encrypted', 'Encrypted documents are not supported.')
    if (code === 'resourceLimit') {
      return failure(
        'processing_limit_exceeded',
        'The document exceeds the supported processing limits.',
        413,
      )
    }
    if (code === 'malformed' || code === 'missingPart' || code === 'unsupported') {
      return failure(
        'invalid_file_content',
        `The uploaded file is not a valid ${extension} document.`,
      )
    }
    console.warn('[converter] conversion_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return failure('conversion_failed', 'The document could not be converted.')
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({
        schemaVersion: 'health.v1',
        status: 'ok',
        service: 'converter',
        version: 'dev',
        environment: env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        uptimeMs: 0,
        checks: [],
      })
    }

    const origin = request.headers.get('origin')
    const origins = allowedOrigins(env)
    if (request.method === 'OPTIONS' && origin && origins.has(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
          vary: 'Origin',
        },
      })
    }

    if (url.pathname !== '/convert') return failure('not_found', 'Not found.', 404)
    if (request.method !== 'POST') {
      return failure('method_not_allowed', 'Method not allowed.', 405)
    }

    const response = await convert(request, env)
    if (origin && origins.has(origin)) {
      response.headers.set('access-control-allow-origin', origin)
      response.headers.set('vary', 'Origin')
    }
    return response
  },
}
