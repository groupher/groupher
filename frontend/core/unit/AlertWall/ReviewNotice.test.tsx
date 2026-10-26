import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import ReviewNotice from './ReviewNotice'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: 'author' }) }))

it('shows the author-safe status without requesting reviewer evidence', async () => {
  request.mockResolvedValue({
    contentReviewNotice: { status: 'waiting_human', failureCode: null },
  })

  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReviewNotice target={{ type: 'ARTICLE', articleId: 'article-1' }} />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('content_review.status.waiting_human')).toBeInTheDocument()
  expect(request.mock.calls[0][1]).toEqual({
    target: { type: 'ARTICLE', articleId: 'article-1' },
  })
})
