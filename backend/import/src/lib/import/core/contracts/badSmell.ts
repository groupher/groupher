/**
 * Implements the Src Lib Import Core Contracts BadSmell boundary inside Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export type TBadSmell = {
  code: string
  level: 'error' | 'warning'
  message: string
  path?: string
  sourceRef?: string
}
