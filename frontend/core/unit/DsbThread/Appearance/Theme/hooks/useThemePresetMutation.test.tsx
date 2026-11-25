import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import { FIELDS } from '~/constant/dsb-fields'
import { dsbKeys } from '~/query'
import type { TDsb } from '~/spec'
import { readDemoFields } from '~/stores/dsbShell/demoFields'
import useDsbShell from '~/stores/dsbShell/hooks'
import DsbShellProvider from '~/stores/dsbShell/provider'

import useThemePresetMutation from './useThemePresetMutation'

const mocks = vi.hoisted(() => ({ executeCommand: vi.fn(), browserGraphQLRequest: vi.fn() }))

vi.mock('~/query/mutation/optimistic/execute', () => ({ executeCommand: mocks.executeCommand }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.browserGraphQLRequest }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))

describe('useThemePresetMutation Demo adapter', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mocks.executeCommand.mockReset()
    mocks.browserGraphQLRequest.mockReset()
  })

  it('saves theme preset fields locally without changing the shared Dsb Query', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const dashboard = { ...FIELDS } as TDsb
    client.setQueryData(dsbKeys.slug('home'), dashboard)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <DsbShellProvider community='home' demoMode initialData={dashboard}>
          {children}
        </DsbShellProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(
      () => ({ dashboard: useDsbShell(), mutation: useThemePresetMutation() }),
      { wrapper },
    )

    act(() => result.current.dashboard.edit('themePreset', THEME_PRESET.CUSTOM))
    act(() => result.current.mutation.saveThemePreset())

    await waitFor(() => expect(readDemoFields('home').themePreset).toBe(THEME_PRESET.CUSTOM))
    expect(client.getQueryData<TDsb>(dsbKeys.slug('home'))?.themePreset).toBe(dashboard.themePreset)
    expect(result.current.dashboard.original.themePreset).toBe(THEME_PRESET.CUSTOM)
    expect(mocks.executeCommand).not.toHaveBeenCalled()
    expect(mocks.browserGraphQLRequest).not.toHaveBeenCalled()
  })
})
