import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HistorySetting from './HistorySetting'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/hooks/useViewingArticle', () => ({ default: () => ({ article: { id: 'article-1' } }) }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('../schema', () => ({
  default: {
    articleHistoryEvents: 'history-events',
    articleHistoryEvent: 'history-event',
    articleHistoryDiff: 'history-diff',
  },
}))

describe('Article history UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads saved versions and renders the selected snapshot comparison', async () => {
    mocks.request
      .mockResolvedValueOnce({
        pagedArticleEvents: {
          items: [
            {
              id: 'event-2',
              sequence: 2,
              type: 'edit',
              occurred_at: '2026-11-17T10:00:00Z',
              after_snapshot_id: 'snapshot-2',
              actor: { nickname: 'Editor' },
            },
            {
              id: 'event-1',
              sequence: 1,
              type: 'create',
              occurred_at: '2026-11-17T09:00:00Z',
              after_snapshot_id: 'snapshot-1',
              actor: { nickname: 'Author' },
            },
          ],
          next_cursor: null,
        },
      })
      .mockResolvedValueOnce({
        articleDiff: { fields: { title: { before: 'Before', after: 'After' } }, body: {} },
      })

    render(<HistorySetting onBack={vi.fn()} />)

    await screen.findByText('article.history.event.edit')
    fireEvent.click(screen.getByText('article.history.compare_versions'))

    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
    expect(mocks.request.mock.calls[0][0]).toBe('history-events')
    expect(mocks.request.mock.calls[1][0]).toBe('history-diff')
    expect(mocks.request.mock.calls[1][1]).toMatchObject({
      articleId: 'article-1',
      before: { type: 'SNAPSHOT', snapshotId: 'snapshot-1' },
      after: { type: 'SNAPSHOT', snapshotId: 'snapshot-2' },
    })
    expect(await screen.findByText(/Before/)).toBeTruthy()
    expect(screen.getByText(/After/)).toBeTruthy()
  })

  it('shows the publisher and unknown attribution alongside known contributors', async () => {
    mocks.request
      .mockResolvedValueOnce({
        pagedArticleEvents: {
          items: [
            {
              id: 'publish-1',
              sequence: 3,
              type: 'publish',
              occurred_at: '2026-11-18T10:00:00Z',
              after_snapshot_id: 'snapshot-3',
              actor: { nickname: 'Publisher' },
            },
          ],
          next_cursor: null,
        },
      })
      .mockResolvedValueOnce({
        articleEvent: {
          id: 'publish-1',
          sequence: 3,
          type: 'publish',
          occurred_at: '2026-11-18T10:00:00Z',
          after_snapshot_id: 'snapshot-3',
          actor: { nickname: 'Publisher' },
          diff: null,
          contributors: {
            items: [
              {
                actor_id: 1,
                actor: { nickname: 'Editor' },
                event_ids: ['edit-1'],
              },
            ],
            next_cursor: null,
            unknown: true,
          },
        },
      })

    render(<HistorySetting onBack={vi.fn()} />)
    fireEvent.click(await screen.findByText('article.history.event.publish'))

    expect(await screen.findByText(/Publisher/)).toBeTruthy()
    expect(screen.getByText('Editor')).toBeTruthy()
    expect(screen.getByText('article.history.contributors_unknown')).toBeTruthy()
  })
})
