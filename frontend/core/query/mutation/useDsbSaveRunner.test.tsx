import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { dsbKeys } from '~/query'
import type { TDsb, TDsbFieldMap } from '~/spec'
import { createDsbShellStore } from '~/stores/dsbShell'
import { readDemoFields } from '~/stores/dsbShell/demoFields'
import type { TDsbEditableFields } from '~/stores/dsbShell/spec'

import useDsbSaveRunner from './useDsbSaveRunner'
import type { TDsbSaveExecution } from './useDsbSaveRunner'

const mocks = vi.hoisted(() => ({ executeCommand: vi.fn(), toast: vi.fn() }))

vi.mock('~/query/mutation/optimistic/execute', () => ({ executeCommand: mocks.executeCommand }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (value: string) => value }) }))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))

describe('useDsbSaveRunner', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mocks.executeCommand.mockReset()
  })

  it('applies a late save to its submitted community and DsbShell session', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    })
    queryClient.setQueryData(dsbKeys.slug('first'), { title: 'first baseline' } as TDsb)
    queryClient.setQueryData(dsbKeys.slug('second'), { title: 'second baseline' } as TDsb)

    const firstStore = createDsbShellStore({ title: 'first baseline' } as TDsbEditableFields)
    firstStore.edit('title', 'submitted title')
    const secondStore = createDsbShellStore({ title: 'second baseline' } as TDsbEditableFields)
    let resolveRequest: (() => void) | undefined
    const responseData = { confirmed: true }
    const execute = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveRequest = () => resolve(responseData)
        }),
    )
    mocks.executeCommand.mockImplementation(({ request }) => request({ commandId: 'command-1' }))

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, rerender } = renderHook(({ community }) => useDsbSaveRunner({ community }), {
      initialProps: { community: 'first' },
      wrapper,
    })
    const request: TDsbSaveExecution = {
      community: 'first',
      demoMode: false,
      dashboardStore: firstStore,
      execute,
      field: 'title' as TDsbSaveExecution['field'],
      savedFields: ['title'],
      submitted: { title: 'submitted title' } as Partial<TDsbFieldMap>,
      readConfirmed: () => ({ title: 'confirmed title' }),
      afterConfirmed: vi.fn(),
    }

    act(() => result.current.save(request))
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    rerender({ community: 'second' })
    expect(result.current.isPending).toBe(false)

    await act(async () => resolveRequest?.())

    await waitFor(() => {
      expect(queryClient.getQueryData<TDsb>(dsbKeys.slug('first'))?.title).toBe('confirmed title')
      expect(queryClient.getQueryData<TDsb>(dsbKeys.slug('second'))?.title).toBe('second baseline')
      expect(firstStore.original.title).toBe('confirmed title')
      expect(secondStore.original.title).toBe('second baseline')
      expect(request.afterConfirmed).toHaveBeenCalledWith(responseData)
    })
  })

  it('keeps Demo saves local and leaves the shared Dsb Query unchanged', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    })
    queryClient.setQueryData(dsbKeys.slug('home'), { title: 'server title' } as TDsb)
    const demoStore = createDsbShellStore({ title: 'server title' } as TDsbEditableFields)
    demoStore.edit('title', 'local demo title')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useDsbSaveRunner({ community: 'home' }), { wrapper })

    act(() =>
      result.current.save({
        community: 'home',
        demoMode: true,
        dashboardStore: demoStore,
        execute: vi.fn(),
        field: 'title' as TDsbSaveExecution['field'],
        savedFields: ['title'],
        submitted: { title: 'local demo title' } as Partial<TDsbFieldMap>,
      }),
    )

    await waitFor(() => expect(readDemoFields('home').title).toBe('local demo title'))
    expect(queryClient.getQueryData<TDsb>(dsbKeys.slug('home'))?.title).toBe('server title')
    expect(demoStore.original.title).toBe('local demo title')
    expect(mocks.executeCommand).not.toHaveBeenCalled()
  })
})
