import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import type { TOptimisticPlan, TOptimisticToggleOperation } from './types'
import useOptimisticToggle from './useOptimisticToggle'

vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ accountRef: 'acct-a', isLogin: true, user: null }),
}))

const emptyPlan: TOptimisticPlan = { changes: [], refetchOnFailure: [] }

describe('useOptimisticToggle', () => {
  it('does not re-render when an unrelated Query changes', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['toggle-state', 'one'], false)
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle',
      entityKey: (target) => target.id,
      read: (context, target) =>
        context.queryClient.getQueryData<boolean>(['toggle-state', target.id]) ?? false,
      queriesToCancel: () => [],
      apply: () => emptyPlan,
      execute: async (_context, _target, state) => state,
      reconcile: () => undefined,
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    let renderCount = 0
    const { result } = renderHook(
      () => {
        renderCount += 1
        return useOptimisticToggle(operation, { id: 'one' })
      },
      { wrapper },
    )
    const initialRenderCount = renderCount

    act(() => queryClient.setQueryData(['unrelated'], { value: 1 }))
    await Promise.resolve()
    expect(renderCount).toBe(initialRenderCount)

    act(() => queryClient.setQueryData(['toggle-state', 'one'], true))
    await waitFor(() => expect(result.current.currentState).toBe(true))
    expect(renderCount).toBeGreaterThan(initialRenderCount)
  })
})
