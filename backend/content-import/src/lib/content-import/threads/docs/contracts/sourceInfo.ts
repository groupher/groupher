/**
 * Implements the Src Lib Content Import Threads Docs Contracts SourceInfo boundary inside Content Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
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
