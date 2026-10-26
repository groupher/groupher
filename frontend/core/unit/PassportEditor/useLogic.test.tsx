import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import useLogic from './useLogic'
const state = vi.hoisted(() => ({ login: 'first', request: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/query', () => ({ viewerQueryKeys: { all: ['viewer'] } }))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({
    accountScope: 'owner',
    user: { login: 'owner', passport: { xx: { root: true } } },
  }),
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'xx' }) }))
vi.mock('~/stores/dsbEditorUi/hooks', () => ({
  useModeratorEditorUi: () => ({ activeModerator: { login: state.login } }),
}))
vi.mock('~/signal', () => ({ closeDrawer: vi.fn() }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
it('loads only the selected target, resetting the draft and isolating late target responses', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  let resolveFirst!: (value: unknown) => void
  state.request.mockImplementation((_doc, args) => {
    if (!args)
      return Promise.resolve({
        allPassportRulesString: {
          cms: { general: { god: false }, community: { 'post.edit': false } },
        },
      })
    if (args.login === 'first')
      return new Promise((resolve) => {
        resolveFirst = resolve
      })
    return Promise.resolve({
      user: {
        passportString: JSON.stringify({
          global: {},
          xx: { root: false, cms: { 'post.edit': true } },
        }),
      },
    })
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const { result, rerender } = renderHook(() => useLogic(), { wrapper })
  state.login = 'second'
  rerender()
  await waitFor(() => expect(result.current.selectedRules).toEqual(['post.edit']))
  await act(async () => {
    resolveFirst({
      user: {
        passportString: JSON.stringify({ global: { god: true }, xx: { root: true, cms: {} } }),
      },
    })
  })
  expect(result.current.isActiveModeratorRoot).toBe(false)
  expect(result.current.selectedGlobalRules).toEqual([])
  expect(state.request).toHaveBeenCalledTimes(3)
  expect(result.current.isReadonly).toBe(false)
})
