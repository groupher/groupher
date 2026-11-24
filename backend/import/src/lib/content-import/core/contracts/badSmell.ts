/**
 * Implements the Src Lib Content Import Core Contracts BadSmell boundary inside Content Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
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
