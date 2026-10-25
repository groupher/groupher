import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import AlertWall from './index'

const state = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/platform', () => ({ dsbRoutes: { section: () => ({}) }, Link: () => null }))
vi.mock('~/query/invalidation/executor', () => ({ invalidateExact: vi.fn() }))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountRef: 'account-a' }) }))

it('loads the next AlertWall page', async () => {
  state.request.mockImplementation(
    async (_document: unknown, variables: { pagi: { offset: { page: number } } }) => ({
      alertItems: {
        entries: [
          {
            id: `item-${variables.pagi.offset.page}`,
            targetType: 'ARTICLE',
            targetId: String(variables.pagi.offset.page),
            summary: `Alert page ${variables.pagi.offset.page}`,
            susNotes: [],
            reportCount: 1,
            version: 1,
          },
        ],
        pageInfo: {
          totalPages: 2,
          hasPreviousPage: variables.pagi.offset.page > 1,
          hasNextPage: variables.pagi.offset.page < 2,
        },
      },
    }),
  )

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AlertWall />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Alert page 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.next_page' }))
  expect(await screen.findByText('Alert page 2')).toBeInTheDocument()
  expect(state.request.mock.calls.some((call) => call[1].pagi?.offset?.page === 2)).toBe(true)
})
