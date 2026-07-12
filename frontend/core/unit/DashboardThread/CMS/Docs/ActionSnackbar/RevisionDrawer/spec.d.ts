import type { TArticleSnapshotActionWire, TArticleSnapshotStageWire } from '~/const/article'

export type TArticleSnapshotStage = TArticleSnapshotStageWire
export type TArticleSnapshotAction = TArticleSnapshotActionWire

export type TArticleSnapshotAuthor = {
  login?: string | null
  nickname?: string | null
  avatar?: string | null
}

export type TArticleSnapshot = {
  id: string
  thread?: string | null
  stage: TArticleSnapshotStage
  action: TArticleSnapshotAction
  articleHashId?: string | null
  title?: string | null
  slug?: string | null
  subtitle?: string | null
  digest?: string | null
  documentJson?: string | null
  contentHash?: string | null
  revisionNumber?: number | null
  schemaVersion?: number | null
  insertedAt?: string | null
  author?: TArticleSnapshotAuthor | null
}

export type TDocDraftSnapshotsPayload = {
  docDraftSnapshots?: TArticleSnapshot[] | null
}
