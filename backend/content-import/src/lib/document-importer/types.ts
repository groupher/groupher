import type { TRichEditorNodeValue } from '@groupher/rich-editor/node'

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
  value: TRichEditorNodeValue
}

export type TDocumentImportErrorPayload = {
  code: string
  diagnostics?: TDocumentImportDiagnostic[]
  message: string
}
