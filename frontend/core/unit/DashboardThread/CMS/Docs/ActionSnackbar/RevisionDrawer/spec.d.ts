import type { TDocSnapshotActionWire, TDocSnapshotStageWire } from '~/const/article'

export type TDocSnapshotStage = TDocSnapshotStageWire
export type TDocSnapshotAction = TDocSnapshotActionWire

export type TDocSnapshotAuthor = {
  login?: string | null
  nickname?: string | null
  avatar?: string | null
}

export type TDocSnapshot = {
  id: string
  thread?: string | null
  stage: TDocSnapshotStage
  action: TDocSnapshotAction
  articleHashId?: string | null
  title?: string | null
  slug?: string | null
  subtitle?: string | null
  digest?: string | null
  documentJson?: string | null
  versionHash?: string | null
  revisionNumber?: number | null
  schemaVersion?: number | null
  insertedAt?: string | null
  author?: TDocSnapshotAuthor | null
}

export type TDocDraftSnapshotsPayload = {
  docDraftSnapshots?: TDocSnapshot[] | null
}
