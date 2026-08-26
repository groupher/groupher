/**
 * Implements the Src Lib Content Import Threads Docs Contracts SourceWorkspace boundary inside Content Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
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
