import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import PendingQueue from './PendingQueue'

const state = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/query/invalidation', () => ({ invalidatePrefix: vi.fn() }))

beforeEach(() => state.request.mockClear())

it('retries a recheck with the same command id after an ambiguous failure', async () => {
  let failFirst = true
  state.request.mockImplementation(
    async (_document: unknown, variables: Record<string, unknown> = {}) => {
      if ('commandId' in variables) {
        if (failFirst) {
          failFirst = false
          throw new Error('response lost after request')
        }
        return { recheckArticle: { action: 'recheck' } }
      }

      return {
        pendingContentReviews: [
          {
            artimentReviewId: 'review-1',
            targetType: 'ARTICLE',
            articleId: 'article-1',
            commentId: null,
            branchId: null,
            communityId: 'community-1',
            state: 'FAILED',
            reviewMode: 'IMMEDIATE',
            systemOpinion: null,
            communityOpinion: null,
          },
        ],
      }
    },
  )

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PendingQueue community='home' />
    </QueryClientProvider>,
  )

  fireEvent.click(await screen.findByRole('button', { name: 'cms_review.action.recheck' }))
  await screen.findByRole('alert')
  const firstCommandId = state.request.mock.calls.find((call) => 'commandId' in (call[1] || {}))![1]
    .commandId

  fireEvent.click(screen.getByRole('button', { name: 'cms_review.action.recheck' }))
  await screen.findByText('failed · IMMEDIATE')

  const rechecks = state.request.mock.calls.filter((call) => 'commandId' in (call[1] || {}))
  expect(rechecks).toHaveLength(2)
  expect(rechecks[1][1].commandId).toBe(firstCommandId)
  expect(rechecks[1][1].scope).toEqual({ type: 'COMMUNITY', community: 'home' })
})

it('offers the existing Doc decision command for platform review work', async () => {
  state.request.mockImplementation(
    async (_document: unknown, variables: Record<string, unknown> = {}) => {
      if ('commandId' in variables) return { approveDoc: { action: 'approve' } }
      return {
        pendingContentReviews: [
          {
            artimentReviewId: 'doc-review',
            targetType: 'DOC',
            articleId: 'article-1',
            commentId: null,
            branchId: 7,
            communityId: null,
            state: 'COMPLETED',
            reviewMode: null,
            systemOpinion: { summary: 'Needs review' },
            communityOpinion: null,
          },
        ],
      }
    },
  )

  render(
    <QueryClientProvider client={new QueryClient()}>
      <PendingQueue />
    </QueryClientProvider>,
  )

  fireEvent.click(await screen.findByRole('button', { name: 'cms_review.action.approve' }))

  await waitFor(() =>
    expect(state.request.mock.calls.some((call) => 'commandId' in (call[1] || {}))).toBe(true),
  )
  const decision = state.request.mock.calls.find((call) => 'commandId' in (call[1] || {}))![1]
  expect(decision.target).toEqual({ type: 'DOC', articleId: 'article-1', branchId: 7 })
  expect(screen.queryByRole('button', { name: 'cms_review.action.recheck' })).toBeNull()
})
