/**
 * Implements the Src Lib Import Threads Docs Contracts SourceWorkspace boundary inside Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export type TSourceFile = {
  path: string
  sizeBytes: number
}

export type TSourceWorkspace = {
  files: readonly TSourceFile[]
  readText: (path: string) => Promise<string>
  revision: string
}
