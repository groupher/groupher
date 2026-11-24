import type {
  ContentImportProcessItemState,
  ContentImportProcessStage,
  ContentImportProcessState,
  ContentImportProcessUnit,
} from '~/lib/graphql/generated/graphql'

export type TImportProcessState = ContentImportProcessState

export type TImportProcessStage = ContentImportProcessStage

export type TImportProcessUnit = ContentImportProcessUnit

export type TImportProcessItem = {
  ref: string
  label: string
  state: ContentImportProcessItemState
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
