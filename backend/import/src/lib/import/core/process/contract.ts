/**
 * Implements the Src Lib Import Core Process Contract boundary inside Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export type TImportProcessState = 'queued' | 'running' | 'completed' | 'failed'

export type TImportProcessStage = 'analyzing' | 'building_preview' | 'preparing' | 'applying'

export type TImportProcessUnit = 'document' | 'release' | 'discussion' | 'post' | 'comment'

export type TImportProcessItem = {
  ref: string
  label: string
  state: 'completed' | 'failed' | 'skipped'
}

export type TImportProcess = {
  state: TImportProcessState
  stage: TImportProcessStage
  progress?: {
    completed: number
    total?: number
    unit: TImportProcessUnit
  }
  recentBatch: TImportProcessItem[]
  updatedAt: string
}
