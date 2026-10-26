import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import AlertWall from './index'

const state = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/platform', () => ({ dsbRoutes: { section: () => ({}) }, Link: () => null }))
vi.mock('~/query/invalidation/executor', () => ({ invalidateExact: vi.fn() }))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: 'account-a' }) }))

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

it('shows a report-only item’s reason and details to the reviewer', async () => {
  state.request.mockImplementation(
    async (_document: unknown, variables: Record<string, unknown>) => {
      if ('id' in variables) {
        return {
          alertItemReports: {
            entries: [
              {
                id: 'report-1',
                reportType: 'SPAM',
                reporterLogin: 'alice',
                details: 'Contains a phone number',
                observedVersion: 2,
                insertedAt: '2026-10-26T00:00:00Z',
                withdrawnAt: null,
                outdatedAt: null,
                resolvedAt: null,
              },
            ],
            pageInfo: { totalPages: 1, hasPreviousPage: false, hasNextPage: false },
          },
        }
      }

      return {
        alertItems: {
          entries: [
            {
              id: 'item-1',
              targetType: 'ARTICLE',
              targetId: 'article-1',
              summary: '',
              susNotes: [],
              reportCount: 1,
              version: 1,
            },
          ],
          pageInfo: { totalPages: 1, hasPreviousPage: false, hasNextPage: false },
        },
      }
    },
  )

  render(
    <QueryClientProvider client={new QueryClient()}>
      <AlertWall />
    </QueryClientProvider>,
  )

  fireEvent.click(await screen.findByRole('button', { name: 'alert_wall.reports (1)' }))
  expect(await screen.findByText('Contains a phone number')).toBeInTheDocument()
  expect(screen.getByText('SPAM · alice · 2026-10-26T00:00:00Z · v2')).toBeInTheDocument()
})

it('opens earlier Wall items below the current queue', async () => {
  state.request.mockImplementation(
    async (_document: unknown, variables: { filter?: { closed: boolean } }) => ({
      alertItems: {
        entries: variables.filter?.closed
          ? [
              {
                id: 'old-item',
                targetType: 'ARTICLE',
                targetId: 'article-1',
                status: 'SUPERSEDED',
                summary: 'Earlier concern',
                susNotes: [],
                reportCount: 0,
                totalReportCount: 1,
                version: 2,
              },
            ]
          : [],
        pageInfo: { totalPages: 1, hasPreviousPage: false, hasNextPage: false },
      },
    }),
  )

  render(
    <QueryClientProvider client={new QueryClient()}>
      <AlertWall />
    </QueryClientProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.history' }))
  expect(await screen.findByText(/Earlier concern/)).toBeInTheDocument()
  expect(screen.getByText(/cms_review.outdated/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'alert_wall.reports (1)' })).toBeInTheDocument()
  expect(state.request.mock.calls.some((call) => call[1].filter?.closed === true)).toBe(true)
})
