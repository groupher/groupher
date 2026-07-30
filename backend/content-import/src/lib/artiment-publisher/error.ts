import type { TRichEditorValidationDiagnostic } from '@groupher/rich-editor/node'

import type { TArtimentPublisherErrorCode } from './types'

type TErrorOptions = {
  diagnostics?: TRichEditorValidationDiagnostic[]
  status?: number
}

/** Stable publisher failure carrying an HTTP status and optional editor diagnostics. */
export class ArtimentPublisherError extends Error {
  readonly code: TArtimentPublisherErrorCode
  readonly diagnostics?: TRichEditorValidationDiagnostic[]
  readonly status: number

  /** Creates an expected publisher failure with a stable code and HTTP projection. */
  constructor(code: TArtimentPublisherErrorCode, message: string, options: TErrorOptions = {}) {
    super(message)
    this.name = 'ArtimentPublisherError'
    this.code = code
    this.diagnostics = options.diagnostics
    this.status = options.status ?? 422
  }
}
