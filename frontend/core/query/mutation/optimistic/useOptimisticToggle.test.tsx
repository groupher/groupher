import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import type { TOptimisticPlan, TOptimisticToggleOperation } from './types'
import useOptimisticToggle from './useOptimisticToggle'

vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ accountScope: 'acct-a', isLogin: true, user: null }),
}))
const mocks = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))
vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: () => 'Action failed. Please try again.' }),
}))

const emptyPlan: TOptimisticPlan = { changes: [] }

describe('useOptimisticToggle', () => {
  beforeEach(() => mocks.toast.mockReset())

  it('does not re-render when an unrelated Query changes', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['toggle-state', 'one'], false)
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle',
      entityKey: (target) => target.id,
      read: (context, target) =>
        context.queryClient.getQueryData<boolean>(['toggle-state', target.id]) ?? false,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      prepare: () => emptyPlan,
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

  it('shows one toast for a shared failure and permits a new attempt', async () => {
    const queryClient = new QueryClient()
    const failures: Array<(error: Error) => void> = []
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle.feedback',
      entityKey: (target) => target.id,
      read: () => false,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      prepare: () => emptyPlan,
      execute: async () => new Promise<boolean>((_resolve, reject) => failures.push(reject)),
      reconcile: () => undefined,
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const first = renderHook(() => useOptimisticToggle(operation, { id: 'same' }), { wrapper })
    const second = renderHook(() => useOptimisticToggle(operation, { id: 'same' }), { wrapper })

    act(() => {
      first.result.current.toggle(true)
      second.result.current.toggle(true)
    })
    await waitFor(() => expect(failures).toHaveLength(1))
    await act(async () => failures.shift()?.(new Error('first failed')))

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1))
    expect(mocks.toast).toHaveBeenLastCalledWith('Action failed. Please try again.', 'error')
    expect(first.result.current.error).toEqual(new Error('first failed'))
    expect(second.result.current.error).toEqual(new Error('first failed'))

    act(() => first.result.current.toggle(true))
    expect(first.result.current.error).toBeNull()
    await waitFor(() => expect(failures).toHaveLength(1))
    await act(async () => failures.shift()?.(new Error('retry failed')))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(2))
    expect(mocks.toast).toHaveBeenCalledTimes(2)
  })

  it('does not show a stale toast after the creating hook unmounts', async () => {
    const queryClient = new QueryClient()
    let rejectRequest: ((error: Error) => void) | undefined
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle.unmount',
      entityKey: (target) => target.id,
      read: () => false,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      prepare: () => emptyPlan,
      execute: async () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectRequest = reject
        }),
      reconcile: () => undefined,
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const hook = renderHook(() => useOptimisticToggle(operation, { id: 'unmount' }), { wrapper })

    act(() => hook.result.current.toggle(true))
    await waitFor(() => expect(rejectRequest).toBeTypeOf('function'))
    hook.unmount()
    await act(async () => {
      rejectRequest?.(new Error('late failure'))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('does not show the previous target pending state after switching targets', () => {
    const queryClient = new QueryClient()
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle.target-scope',
      entityKey: (target) => target.id,
      read: () => false,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      prepare: () => emptyPlan,
      execute: async (_context, _target, state) => state,
      reconcile: () => undefined,
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const hook = renderHook(({ id }) => useOptimisticToggle(operation, { id }), {
      initialProps: { id: 'first' },
      wrapper,
    })

    act(() => hook.result.current.toggle(true))
    expect(hook.result.current.visibleState).toBe(true)

    hook.rerender({ id: 'second' })
    expect(hook.result.current.visibleState).toBe(false)
  })

  it('does not revive a pending value after leaving and returning to its scope', async () => {
    const queryClient = new QueryClient()
    let settle: ((value: boolean) => void) | undefined
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle.returned-scope',
      entityKey: (target) => target.id,
      read: () => false,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      prepare: () => emptyPlan,
      execute: async (_context, _target, state) =>
        new Promise<boolean>((resolve) => {
          settle = resolve
        }).then(() => state),
      reconcile: () => undefined,
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const hook = renderHook(({ id }) => useOptimisticToggle(operation, { id }), {
      initialProps: { id: 'first' },
      wrapper,
    })

    act(() => hook.result.current.toggle(true))
    expect(hook.result.current.visibleState).toBe(true)
    hook.rerender({ id: 'second' })
    hook.rerender({ id: 'first' })
    expect(hook.result.current.visibleState).toBe(false)

    await waitFor(() => expect(settle).toBeTypeOf('function'))
    await act(async () => settle?.(true))
    expect(hook.result.current.visibleState).toBe(false)
  })
})
