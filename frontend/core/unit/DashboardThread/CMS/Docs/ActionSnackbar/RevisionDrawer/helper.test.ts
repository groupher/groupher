import type { TRichEditorValue } from '@groupher/rich-editor'
import { describe, expect, it } from 'vitest'

import { buildRevisionDiffModel, buildSnapshotDiffEntries, hasRevisionDiffStats } from './helper'
import type { TArticleSnapshot } from './spec'

const value = (...texts: string[]): TRichEditorValue =>
  texts.map((text, index) => ({
    children: [{ text }],
    id: `block-${index + 1}`,
    type: 'p',
  })) as TRichEditorValue

const snapshot = (id: string, documentValue: TRichEditorValue): TArticleSnapshot => ({
  id,
  contentHash: id,
  documentJson: JSON.stringify(documentValue),
  insertedAt: '2026-06-29T10:00:00Z',
  stage: 'DRAFT',
})

describe('revision diff model', () => {
  it('sums staged snapshot diffs and current Now diff', () => {
    const model = buildRevisionDiffModel({
      baselineValue: value(''),
      bodyValue: value('intro'),
      draftRevisions: [
        snapshot('draft-2', value('intro', 'details')),
        snapshot('draft-1', value('intro')),
      ],
      publishedRevisions: [],
    })

    expect(model.currentStats).toEqual({ additions: 0, deletions: 1 })
    expect(model.stagedEntries.map((entry) => entry.stats)).toEqual([
      { additions: 1, deletions: 0 },
      { additions: 1, deletions: 0 },
    ])
    expect(model.stagedStats).toEqual({ additions: 2, deletions: 1 })
  })

  it('filters snapshot entries without visible diff stats', () => {
    const latestPublishedRevision = snapshot('published', value('intro'))
    const entries = buildSnapshotDiffEntries([snapshot('same-current', value('intro'))], {
      latestPublishedRevision,
      useLatestPublishedFallback: true,
    })

    expect(entries).toEqual([])
    expect(hasRevisionDiffStats({ additions: 0, deletions: 0 })).toBe(false)
  })
})
