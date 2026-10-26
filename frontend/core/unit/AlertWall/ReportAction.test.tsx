import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import ReportAction from './ReportAction'

const state = vi.hoisted(() => ({
  request: vi.fn(),
  login: true,
  accountScope: 'account-a',
}))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ isLogin: state.login, accountScope: state.accountScope }),
}))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/signal', () => ({ authWarn: vi.fn() }))

const target = {
  type: 'ARTICLE' as const,
  article: { community: 'home', thread: 'POST' as const, innerId: '17' },
  observedVersion: 1,
}

const renderReportAction = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ReportAction target={target} />
    </QueryClientProvider>,
  )

beforeEach(() => {
  state.login = true
  state.accountScope = 'account-a'
  let rejectNextSubmit = true
  state.request.mockImplementation(
    async (_document: unknown, variables: Record<string, unknown>) => {
      if ('input' in variables) {
        if (rejectNextSubmit) {
          rejectNextSubmit = false
          throw new Error('response lost after request')
        }
        return { submitReport: { id: 'report-1', reportType: 'SPAM' } }
      }
      throw new Error('Unexpected GraphQL operation')
    },
  )
})

it('retries a report with the same command id after an ambiguous failure', async () => {
  renderReportAction()

  fireEvent.click(await screen.findByRole('button', { name: 'alert_wall.report' }))
  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report_submit' }))

  await screen.findByRole('alert')
  const submitCalls = state.request.mock.calls.filter((call) => 'input' in call[1])
  const firstCommandId = submitCalls[0][1].commandId
  expect(firstCommandId).toBeTruthy()
  expect(
    (submitCalls[0][1].input as { target: { observedVersion: number } }).target.observedVersion,
  ).toBe(1)

  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report_submit' }))
  await screen.findByText('alert_wall.report_submitted')

  const retriedCalls = state.request.mock.calls.filter((call) => 'input' in call[1])
  expect(retriedCalls).toHaveLength(2)
  expect(retriedCalls[1][1].commandId).toBe(firstCommandId)

  expect(screen.getByText('alert_wall.report_submitted')).toBeInTheDocument()
})

it('re-enables a failed report form after cancel and reopen', async () => {
  renderReportAction()

  fireEvent.click(await screen.findByRole('button', { name: 'alert_wall.report' }))
  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report_submit' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('combobox')).toBeEnabled()

  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report_cancel' }))
  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report' }))

  expect(screen.getByRole('combobox')).toBeEnabled()
  expect(screen.getByRole('textbox')).toBeEnabled()
})

it('asks the reporter to refresh when the public content changed', async () => {
  state.request.mockRejectedValueOnce(
    Object.assign(new Error('content changed'), { errors: [{ extensions: { code: 4548 } }] }),
  )
  renderReportAction()

  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report' }))
  fireEvent.click(screen.getByRole('button', { name: 'alert_wall.report_submit' }))

  expect(await screen.findByText('alert_wall.report_content_changed')).toBeInTheDocument()
})
