import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import MyReports from './MyReports'

const state = vi.hoisted(() => ({ request: vi.fn(), active: true, accountRef: 'account-a' }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountRef: state.accountRef }) }))

beforeEach(() => {
  state.active = true
  state.accountRef = 'account-a'
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
