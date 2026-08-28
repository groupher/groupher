/**
 * Implements the Src Lib Document Importer Error boundary inside Content Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import type { TDocumentImportDiagnostic } from './types'

/** Stable Import Content failure carrying HTTP status and source/editor diagnostics. */
export class DocumentImporterError extends Error {
  readonly code: string
  readonly diagnostics?: TDocumentImportDiagnostic[]
  readonly status: number

  /** Creates an expected import failure with a stable code and HTTP projection. */
  constructor(
    code: string,
    message: string,
    options: { diagnostics?: TDocumentImportDiagnostic[]; status?: number } = {},
  ) {
    super(message)
    this.name = 'DocumentImporterError'
    this.code = code
    this.diagnostics = options.diagnostics
    this.status = options.status ?? 400
  }
}
