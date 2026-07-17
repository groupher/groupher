import type { TRichEditorValue } from '@groupher/rich-editor'
import { describe, expect, it } from 'vitest'

import {
  buildRevisionHistory,
  buildSnapshotDiffPairs,
  dedupeRevisionsBySnapshot,
  EMPTY_REVISION_VALUE,
  parseRevisionDocumentValue,
} from './model'
import type { TArticleSnapshot } from './spec'

const value = (...texts: string[]): TRichEditorValue =>
  texts.map((text, index) => ({
    children: [{ text }],
    id: `block-${index + 1}`,
    type: 'p',
  })) as TRichEditorValue

const snapshot = (
  id: string,
  documentValue: TRichEditorValue,
  stage: TArticleSnapshot['stage'] = 'DRAFT',
): TArticleSnapshot => ({
  action: 'CHECKPOINT',
  id,
  versionHash: id,
  documentJson: JSON.stringify(documentValue),
  insertedAt: '2026-06-29T10:00:00Z',
  stage,
})

describe('revision history model', () => {
  it('only constructs ordered document pairs and does not calculate diff', () => {
    const pairs = buildSnapshotDiffPairs([
      snapshot('draft-2', value('intro', 'details')),
      snapshot('draft-1', value('intro')),
    ])

    expect(pairs).toHaveLength(2)
    expect(pairs[0]).toMatchObject({
      after: value('intro', 'details'),
      before: value('intro'),
      key: 'revision:draft-2:draft-1',
    })
    expect(pairs[1]).toMatchObject({
      before: EMPTY_REVISION_VALUE,
      key: 'revision:draft-1:empty',
    })
    expect(pairs.every((pair) => !('stats' in pair) && !('diffValue' in pair))).toBe(true)
  })

  it('uses the latest published snapshot as the oldest staged fallback', () => {
    const published = snapshot('published-1', value('published'), 'PUBLIC')
    const history = buildRevisionHistory({
      draftRevisions: [snapshot('draft-1', value('draft'))],
      publishedRevisions: [published],
    })

    expect(history.currentBaselineValue).toEqual(value('draft'))
    expect(history.publishedBaselineValue).toEqual(value('published'))
    expect(history.stagedPairs[0]).toMatchObject({
      before: value('published'),
      key: 'revision:draft-1:published-1',
    })
    expect(history.publishedPairs[0].before).toEqual(EMPTY_REVISION_VALUE)
  })

  it('shares the parsed published baseline when there is no draft snapshot', () => {
    const published = snapshot('published-1', value('published'), 'PUBLIC')
    const history = buildRevisionHistory({
      draftRevisions: [],
      publishedRevisions: [published],
    })

    expect(history.currentBaselineValue).toBe(history.publishedBaselineValue)
  })

  it('uses an empty document as the current and publish baseline before the first publication', () => {
    const history = buildRevisionHistory({
      draftRevisions: [],
      publishedRevisions: [],
    })

    expect(history.currentBaselineValue).toBe(EMPTY_REVISION_VALUE)
    expect(history.publishedBaselineValue).toBe(EMPTY_REVISION_VALUE)
  })

  it('deduplicates snapshots before constructing stable cache keys', () => {
    const duplicate = snapshot('duplicate', value('same'))
    duplicate.versionHash = 'same-hash'
    const original = snapshot('original', value('same'))
    original.versionHash = 'same-hash'

    const deduped = dedupeRevisionsBySnapshot([duplicate, original])
    const history = buildRevisionHistory({
      draftRevisions: [duplicate, original],
      publishedRevisions: [],
    })

    expect(deduped).toEqual({ hiddenCount: 1, revisions: [duplicate] })
    expect(history.hiddenDraftDuplicateCount).toBe(1)
    expect(history.stagedPairs).toHaveLength(1)
    expect(history.stagedPairs[0].key).toBe('revision:same-hash:empty')
  })

  it('falls back to an empty Plate document for invalid snapshots', () => {
    expect(parseRevisionDocumentValue()).toBe(EMPTY_REVISION_VALUE)
    expect(parseRevisionDocumentValue('{invalid')).toBe(EMPTY_REVISION_VALUE)
    expect(parseRevisionDocumentValue('{"type":"p"}')).toBe(EMPTY_REVISION_VALUE)
  })
})
