import type { TRichEditorValue } from '@groupher/rich-editor'

/**
 * Browser client for the shared single-document Import Content boundary.
 *
 * @see docs/bulk-import/article-publish-import-refactor.md
 */

export const DOCUMENT_IMPORT_ACCEPT = '.pdf,.docx,.pptx,.xlsx,.html,.htm'
export const DOCUMENT_IMPORT_MAX_FILE_BYTES = 25 * 1024 * 1024

export type TDocumentImportDiagnostic = {
  level: 'warning' | 'error'
  code: string
  message: string
  nodeType?: string
  path?: number[]
}

export type TDocumentImportSource = {
  filename: string
  mimeType: string
  sizeBytes: number
}

export type TDocumentImportResult = {
  diagnostics: TDocumentImportDiagnostic[]
  markdown: string
  source: TDocumentImportSource
  value: TRichEditorValue
}

type TImportResponse = {
  error?: {
    code?: string
    diagnostics?: TDocumentImportDiagnostic[]
    message?: string
  }
  ok?: boolean
  result?: TDocumentImportResult
}

const readResponse = async (response: Response): Promise<TImportResponse> => {
  try {
    return (await response.json()) as TImportResponse
  } catch {
    throw new Error('Document import returned an invalid response.')
  }
}

const unwrapResponse = async (response: Response): Promise<TDocumentImportResult> => {
  const payload = await readResponse(response)

  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(
      payload.error?.message ||
        payload.error?.diagnostics?.[0]?.message ||
        'Document import failed.',
    )
  }

  return payload.result
}

/** Uploads one supported local file and returns its Markdown and editable Plate value. */
export const importDocument = async (file: File): Promise<TDocumentImportResult> => {
  if (file.size > DOCUMENT_IMPORT_MAX_FILE_BYTES) {
    throw new Error('The selected file exceeds the 25 MiB limit.')
  }

  const formData = new FormData()
  formData.set('file', file, file.name)

  const response = await fetch('/api/artiment/import', {
    body: formData,
    method: 'POST',
  })

  return unwrapResponse(response)
}

/** Imports one public documentation URL exposed as bounded Markdown. */
export const importDocumentationPlatform = async (url: string): Promise<TDocumentImportResult> => {
  const response = await fetch('/api/artiment/import', {
    body: JSON.stringify({ source: 'documentation-url', url }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return unwrapResponse(response)
}
