/**
 * Implements the Src Lib Content Import Core Errors boundary inside Content Import.
 *
 * Business position:
 *
 *   Dashboard / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export type TDocsImportStage = 'admission' | 'analyzing' | 'downloading' | 'extracting' | 'preview'

/** Stable source-analysis error carried across HTTP and Workflow boundaries.
 *
 * @see docs/bulk-import/import-error-handling.md
 */
export class DocsImportError extends Error {
  /** Creates one stable workflow-safe error with retry and stage metadata. */
  constructor(
    readonly code: string,
    readonly stage: TDocsImportStage,
    message: string,
    readonly retryable = false,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DocsImportError'
  }
}
