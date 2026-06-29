export type TArticleSnapshotStage = 'DRAFT' | 'PUBLIC'

export type TArticleSnapshotAuthor = {
  login?: string | null
  nickname?: string | null
  avatar?: string | null
}

export type TArticleSnapshot = {
  id: string
  articleThread?: string | null
  stage: TArticleSnapshotStage
  articleId?: string | null
  workspaceId?: string | null
  title?: string | null
  slug?: string | null
  subtitle?: string | null
  digest?: string | null
  documentJson?: string | null
  contentHash?: string | null
  snapshotNumber?: number | null
  schemaVersion?: number | null
  insertedAt?: string | null
  author?: TArticleSnapshotAuthor | null
}

export type TDocDraftSnapshotsPayload = {
  docDraftSnapshots?: TArticleSnapshot[] | null
}
