import type { TRichEditorValue } from '@groupher/rich-editor'
import type { TRichEditorDiffStats } from '@groupher/rich-editor/diff'

import type { TArticleSnapshot } from './spec'

export type TDedupedRevisions = {
  hiddenCount: number
  revisions: TArticleSnapshot[]
}

export type TRevisionDiffPair = {
  after: TRichEditorValue
  before: TRichEditorValue
  key: string
}

export type TRevisionSnapshotPair = TRevisionDiffPair & {
  revision: TArticleSnapshot
}

export type TRevisionDiffSummary = {
  hasChanges: boolean
  stats: TRichEditorDiffStats
}

export type TRevisionDiffEntry = TRevisionSnapshotPair & TRevisionDiffSummary

export type TRevisionHistory = {
  currentBaselineValue: TRichEditorValue
  hiddenDraftDuplicateCount: number
  publishedBaselineValue: TRichEditorValue
  publishedPairs: TRevisionSnapshotPair[]
  stagedPairs: TRevisionSnapshotPair[]
}

export type TRevisionDiffModel = {
  current: TRevisionDiffPair & TRevisionDiffSummary & { pending: boolean }
  hiddenDraftDuplicateCount: number
  publish: TRevisionDiffPair & TRevisionDiffSummary & { pending: boolean }
  publishedPending: boolean
  publishedEntries: TRevisionDiffEntry[]
  stagedPending: boolean
  stagedEntries: TRevisionDiffEntry[]
}

export const EMPTY_DIFF_STATS: TRichEditorDiffStats = { additions: 0, deletions: 0 }

export const EMPTY_REVISION_VALUE: TRichEditorValue = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
]

export const parseRevisionDocumentValue = (json?: string | null): TRichEditorValue => {
  if (!json) return EMPTY_REVISION_VALUE

  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? (value as TRichEditorValue) : EMPTY_REVISION_VALUE
  } catch {
    return EMPTY_REVISION_VALUE
  }
}

export const dedupeRevisionsBySnapshot = (revisions: TArticleSnapshot[]): TDedupedRevisions => {
  const seen = new Set<string>()
  const deduped: TArticleSnapshot[] = []

  for (const revision of revisions) {
    const key = revision.versionHash || revision.documentJson || revision.id

    if (seen.has(key)) continue

    seen.add(key)
    deduped.push(revision)
  }

  return {
    hiddenCount: revisions.length - deduped.length,
    revisions: deduped,
  }
}

const snapshotIdentity = (revision?: TArticleSnapshot): string =>
  revision ? revision.versionHash || revision.id : 'empty'

export const buildSnapshotDiffPairs = (
  revisions: TArticleSnapshot[],
  options: {
    latestPublishedRevision?: TArticleSnapshot
    useLatestPublishedFallback?: boolean
  } = {},
): TRevisionSnapshotPair[] =>
  revisions.map((revision, index) => {
    const previousRevision =
      revisions[index + 1] ||
      (options.useLatestPublishedFallback ? options.latestPublishedRevision : undefined)

    return {
      after: parseRevisionDocumentValue(revision.documentJson),
      before: previousRevision
        ? parseRevisionDocumentValue(previousRevision.documentJson)
        : EMPTY_REVISION_VALUE,
      key: `revision:${snapshotIdentity(revision)}:${snapshotIdentity(previousRevision)}`,
      revision,
    }
  })

export const buildRevisionHistory = (params: {
  draftRevisions: TArticleSnapshot[]
  publishedRevisions: TArticleSnapshot[]
}): TRevisionHistory => {
  const { hiddenCount: hiddenDraftDuplicateCount, revisions: draftRevisions } =
    dedupeRevisionsBySnapshot(params.draftRevisions)
  const latestPublishedRevision = params.publishedRevisions[0]
  const latestPublishedValue = latestPublishedRevision
    ? parseRevisionDocumentValue(latestPublishedRevision.documentJson)
    : EMPTY_REVISION_VALUE
  const currentBaselineValue = draftRevisions[0]
    ? parseRevisionDocumentValue(draftRevisions[0].documentJson)
    : latestPublishedValue

  return {
    currentBaselineValue,
    hiddenDraftDuplicateCount,
    publishedBaselineValue: latestPublishedValue,
    publishedPairs: buildSnapshotDiffPairs(params.publishedRevisions),
    stagedPairs: buildSnapshotDiffPairs(draftRevisions, {
      latestPublishedRevision,
      useLatestPublishedFallback: true,
    }),
  }
}
