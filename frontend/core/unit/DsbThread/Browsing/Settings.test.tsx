import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { FIELDS } from '~/constant/dsb-fields'
import { readDemoFields } from '~/stores/dsbShell/demoFields'
import DsbShellProvider from '~/stores/dsbShell/provider'

import PagiModeSettings from './Settings'
const state = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/query', () => ({ dsbKeys: { slug: (slug: string) => ['dsb', slug] } }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'xx' }) }))
vi.mock('~/stores/dsb/hooks', () => ({
  default: () => ({ pagiMode: 'PAGE', pagiMobileMode: 'INFINITE_SCROLL', pagiRevision: 4 }),
}))
vi.mock('~/query/mutation/optimistic/execute', () => ({
  executeCommand: (args: unknown) => {
    const { request, variables } = args as {
      request: (variables: unknown) => unknown
      variables: unknown
    }

    return request(variables)
  },
}))
it('saves one community mode with revision and patches the canonical dashboard owner', async () => {
  const client = new QueryClient()
  client.setQueryData(['dsb', 'xx'], {
    pagiMode: 'PAGE',
    pagiMobileMode: 'INFINITE_SCROLL',
    pagiRevision: 4,
  })
  state.request.mockResolvedValue({
    updateDashboardPagiMode: {
      pagiMode: 'INFINITE_SCROLL',
      pagiMobileMode: 'LOAD_MORE',
      pagiRevision: 5,
    },
  })
  render(
    <QueryClientProvider client={client}>
      <DsbShellProvider
        community='xx'
        demoMode={false}
        initialData={{
          ...FIELDS,
          pagiMode: 'PAGE',
          pagiMobileMode: 'INFINITE_SCROLL',
          pagiRevision: 4,
        }}
      >
        <PagiModeSettings />
      </DsbShellProvider>
    </QueryClientProvider>,
  )
  expect(screen.getAllByRole('radio')).toHaveLength(6)
  fireEvent.click(
    within(screen.getByRole('group', { name: 'dsb.pagi.desktop' })).getByRole('radio', {
      name: 'dsb.pagi.infinite_scroll',
    }),
  )
  fireEvent.click(
    within(screen.getByRole('group', { name: 'dsb.pagi.mobile' })).getByRole('radio', {
      name: 'dsb.pagi.load_more',
    }),
  )
  const saveButton = screen.getByRole('button', { name: 'dsb.pagi.save' })
  await waitFor(() => expect(saveButton).toBeEnabled())
  fireEvent.click(saveButton)
  await waitFor(() => expect(state.request).toHaveBeenCalledTimes(1))
  expect(state.request.mock.calls[0][1]).toEqual({
    community: 'xx',
    mode: 'INFINITE_SCROLL',
    mobileMode: 'LOAD_MORE',
    expectedRevision: 4,
  })
  await waitFor(() =>
    expect(client.getQueryData(['dsb', 'xx'])).toMatchObject({
      pagiMode: 'INFINITE_SCROLL',
      pagiMobileMode: 'LOAD_MORE',
      pagiRevision: 5,
    }),
  )
  expect(state.request.mock.calls[0][1]).not.toHaveProperty('surface')
  expect(state.request.mock.calls[0][1]).not.toHaveProperty('config')
})

it('saves Demo pagination locally without changing the shared dashboard Query', async () => {
  window.localStorage.clear()
  state.request.mockReset()
  const client = new QueryClient()
  client.setQueryData(['dsb', 'xx'], {
    pagiMode: 'PAGE',
    pagiMobileMode: 'INFINITE_SCROLL',
    pagiRevision: 4,
  })
  render(
    <QueryClientProvider client={client}>
      <DsbShellProvider
        community='xx'
        demoMode
        initialData={{
          ...FIELDS,
          pagiMode: 'PAGE',
          pagiMobileMode: 'INFINITE_SCROLL',
          pagiRevision: 4,
        }}
      >
        <PagiModeSettings />
      </DsbShellProvider>
    </QueryClientProvider>,
  )
  fireEvent.click(
    within(screen.getByRole('group', { name: 'dsb.pagi.desktop' })).getByRole('radio', {
      name: 'dsb.pagi.infinite_scroll',
    }),
  )
  fireEvent.click(
    within(screen.getByRole('group', { name: 'dsb.pagi.mobile' })).getByRole('radio', {
      name: 'dsb.pagi.load_more',
    }),
  )
  const saveButton = screen.getByRole('button', { name: 'dsb.pagi.save' })
  await waitFor(() => expect(saveButton).toBeEnabled())
  fireEvent.click(saveButton)

  await waitFor(() =>
    expect(readDemoFields('xx')).toMatchObject({
      pagiMode: 'INFINITE_SCROLL',
      pagiMobileMode: 'LOAD_MORE',
    }),
  )
  expect(client.getQueryData(['dsb', 'xx'])).toMatchObject({
    pagiMode: 'PAGE',
    pagiMobileMode: 'INFINITE_SCROLL',
    pagiRevision: 4,
  })
  expect(state.request).not.toHaveBeenCalled()
})
