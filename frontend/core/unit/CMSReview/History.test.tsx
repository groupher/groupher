import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import History from './History'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))

it('shows an earlier check separately from a check of edited content', async () => {
  request.mockResolvedValue({
    contentReviewHistory: [
      {
        artimentReviewId: 'current',
        state: 'FAILED',
        outdatedAt: null,
        replacedAt: null,
        failureCode: 'provider_unavailable',
        failureMessage: 'The check failed.',
        systemOpinion: null,
        communityOpinion: null,
      },
      {
        artimentReviewId: 'earlier',
        state: 'COMPLETED',
        outdatedAt: null,
        replacedAt: '2026-10-26T00:00:00Z',
        failureCode: null,
        failureMessage: null,
        systemOpinion: { summary: 'Earlier opinion' },
        communityOpinion: null,
      },
      {
        artimentReviewId: 'edited',
        state: 'COMPLETED',
        outdatedAt: '2026-10-25T00:00:00Z',
        replacedAt: '2026-10-25T00:00:00Z',
        failureCode: null,
        failureMessage: null,
        systemOpinion: { summary: 'Old content opinion' },
        communityOpinion: null,
      },
    ],
  })

  render(
    <QueryClientProvider client={new QueryClient()}>
      <History target={{ type: 'ARTICLE', articleId: 'article-1' }} />
    </QueryClientProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'cms_review.history' }))

  expect(await screen.findByText('The check failed. (provider_unavailable)')).toBeInTheDocument()
  expect(screen.getByText('Earlier opinion')).toBeInTheDocument()
  expect(screen.getByText('Old content opinion')).toBeInTheDocument()
  expect(screen.getByText('cms_review.earlier_check · completed')).toBeInTheDocument()
  expect(screen.getByText('cms_review.outdated · completed')).toBeInTheDocument()
})
