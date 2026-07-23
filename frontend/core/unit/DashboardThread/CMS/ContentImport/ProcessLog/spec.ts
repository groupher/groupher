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
