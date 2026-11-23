/**
 * Implements the Src Lib Import Threads Docs Contracts SourceInfo boundary inside Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export type TDocImportSourceInfo = {
  branch: string
  commit: string
  configPaths: string[]
  contentRoot: string
  framework: string
  repo: string
  repoUrl: string
}
