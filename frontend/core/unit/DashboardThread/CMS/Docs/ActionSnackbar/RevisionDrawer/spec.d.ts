export type TArticleRevisionType = 'DRAFT' | 'PUBLISHED'

export type TArticleRevisionAuthor = {
  login?: string | null
  nickname?: string | null
  avatar?: string | null
}

export type TArticleRevision = {
  id: string
  thread?: string | null
  type: TArticleRevisionType
  articleId?: string | null
  articleDraftId?: string | null
  title?: string | null
  slug?: string | null
  subtitle?: string | null
  digest?: string | null
  documentJson?: string | null
  contentHash?: string | null
  revisionNumber?: number | null
  schemaVersion?: number | null
  insertedAt?: string | null
  author?: TArticleRevisionAuthor | null
}

export type TDocDraftRevisionPayload = {
  docDraftRevisions?: TArticleRevision[] | null
}
