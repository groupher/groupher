import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ArticleHistoryPane from './ArticleHistoryPane'
import type { ArticleEvent, ArticleEventDetail } from './types'

vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('./salon', () => ({ default: () => ({ button: '', row: '', text: '', tree: '' }) }))
vi.mock('./ArticleDiffPane', () => ({ default: () => null }))

const event = (id: string, sequence: number, snapshotId: string): ArticleEvent => ({
  id,
  sequence,
  type: 'edit',
  actor_type: 'user',
  actor_id: 1,
  actor: { login: 'editor', nickname: 'Editor' },
  occurred_at: '2026-11-18T08:00:00Z',
  before_snapshot_id: null,
  after_snapshot_id: snapshotId,
  before_revision: null,
  after_revision: sequence,
})

describe('ArticleHistoryPane', () => {
  it('keeps the newest event when multiple events reference one Snapshot', () => {
    render(
      <ArticleHistoryPane
        data={{
          items: [event('event-5', 5, 'snapshot-shared'), event('event-3', 3, 'snapshot-shared')],
          next_cursor: null,
        }}
        onSelect={vi.fn()}
        onNext={vi.fn()}
        onContributorNext={vi.fn()}
        onFilterActor={vi.fn()}
        onCompare={vi.fn()}
      />,
    )

    const selects = screen.getAllByRole('combobox')
    for (const select of selects.slice(1)) {
      expect(select.querySelectorAll('option')).toHaveLength(1)
      expect(select.textContent).toBe('#5 · dsb.doc.publication.event.edit')
    }
  })

  it('shows unknown attribution even when some contributors are present', () => {
    const detail: ArticleEventDetail = {
      ...event('publish-1', 6, 'snapshot-published'),
      type: 'publish',
      diff: null,
      contributors: {
        items: [
          {
            actor_type: 'user',
            actor_id: 1,
            actor: { login: 'editor', nickname: 'Editor' },
            event_ids: ['event-5'],
            first_sequence: 5,
          },
        ],
        next_cursor: null,
        unknown: true,
      },
    }

    render(
      <ArticleHistoryPane
        data={detail}
        onSelect={vi.fn()}
        onNext={vi.fn()}
        onContributorNext={vi.fn()}
        onFilterActor={vi.fn()}
        onCompare={vi.fn()}
      />,
    )

    expect(screen.getByText('dsb.doc.publication.contributors_unknown')).toBeTruthy()
    expect(screen.getByText('Editor')).toBeTruthy()
  })
})
