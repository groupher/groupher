import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import MyReports from './MyReports'

const state = vi.hoisted(() => ({ request: vi.fn(), active: true, accountScope: 'account-a' }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: state.accountScope }) }))

beforeEach(() => {
  state.active = true
  state.accountScope = 'account-a'
  state.request.mockImplementation(
    async (_document: unknown, variables: Record<string, unknown>) => {
      if ('reportId' in variables) {
        state.active = false
        return { withdrawReport: { id: 'report-1', withdrawnAt: '2026-10-23T00:00:00Z' } }
      }

      return {
        myReports: {
          entries: [
            {
              id: 'report-1',
              targetType: 'COMMENT',
              targetId: '44',
              communityId: '7',
              itemId: '1',
              reportType: 'SPAM',
              details: 'Hidden after report',
              withdrawnAt: state.active ? null : '2026-10-23T00:00:00Z',
              insertedAt: '2026-10-22T00:00:00Z',
            },
          ],
        },
      }
    },
  )
})

it('withdraws a report from the account list without loading its target', async () => {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MyReports show onClose={() => {}} />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('comment · 44')).toBeInTheDocument()
  expect(screen.getByText('Hidden after report')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report_withdraw' }))

  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'alert_wall.report_withdraw' }),
    ).not.toBeInTheDocument(),
  )
  expect(state.request.mock.calls.some((call) => 'reportId' in call[1])).toBe(true)
  expect(state.request.mock.calls.some((call) => 'pagi' in call[1])).toBe(true)
})

it('loads the next report page from the server', async () => {
  state.request.mockImplementation(
    async (_document: unknown, variables: { pagi: { offset: { page: number } } }) => ({
      myReports: {
        entries: [
          {
            id: `report-${variables.pagi.offset.page}`,
            targetType: 'COMMENT',
            targetId: String(variables.pagi.offset.page),
            communityId: '7',
            itemId: '1',
            reportType: 'SPAM',
            details: `Report page ${variables.pagi.offset.page}`,
            withdrawnAt: null,
            insertedAt: '2026-10-22T00:00:00Z',
          },
        ],
        pageInfo: {
          totalPages: 2,
          totalCount: 2,
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
      <MyReports show onClose={() => {}} />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('comment · 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.next_page' }))
  expect(await screen.findByText('comment · 2')).toBeInTheDocument()
  expect(state.request.mock.calls.some((call) => call[1].pagi?.offset?.page === 2)).toBe(true)
})

it('folds reports about content before the latest edit', async () => {
  state.request.mockResolvedValue({
    myReports: {
      entries: [
        {
          id: 'new',
          targetType: 'ARTICLE',
          targetId: 'new-content',
          itemId: '2',
          reportType: 'SPAM',
          details: 'Current report',
          withdrawnAt: null,
          outdatedAt: null,
          resolvedAt: null,
          insertedAt: '2026-10-26T00:00:00Z',
        },
        {
          id: 'old',
          targetType: 'ARTICLE',
          targetId: 'old-content',
          itemId: '1',
          reportType: 'SPAM',
          details: 'Old report',
          withdrawnAt: null,
          outdatedAt: '2026-10-25T00:00:00Z',
          resolvedAt: '2026-10-26T00:00:00Z',
          resolution: 'reviewed',
          insertedAt: '2026-10-24T00:00:00Z',
        },
      ],
    },
  })

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MyReports show onClose={() => {}} />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Current report')).toBeInTheDocument()
  expect(screen.getByText('Old report').closest('details')).not.toHaveAttribute('open')
  expect(screen.getByText('alert_wall.older_reports (1)')).toBeInTheDocument()
  expect(screen.getByText('cms_review.outdated')).toBeInTheDocument()
  expect(screen.getByText('alert_wall.report_resolved')).toBeInTheDocument()
})
