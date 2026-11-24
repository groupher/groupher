import type {
  ImportProcessItemState,
  ImportProcessStage,
  ImportProcessState,
  ImportProcessUnit,
} from '~/lib/graphql/generated/graphql'

export type TImportProcessState = ImportProcessState

export type TImportProcessStage = ImportProcessStage

export type TImportProcessUnit = ImportProcessUnit

export type TImportProcessItem = {
  ref: string
  label: string
  state: ImportProcessItemState
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
