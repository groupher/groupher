import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { FIELDS } from '~/constant/dsb-fields'
import { dsbKeys } from '~/query'
import type { TDsb } from '~/spec'

import { writeDemoFields } from './demoFields'
import useDsbShell from './hooks'
import DsbShellProvider from './provider'

describe('DsbShellProvider', () => {
  it('projects saved Demo fields without writing them into the shared Dsb Query', async () => {
    window.localStorage.clear()
    writeDemoFields('home', { title: 'local demo title' })
    const client = new QueryClient()
    const serverDashboard = { ...FIELDS, title: 'server title' } as TDsb
    client.setQueryData(dsbKeys.slug('home'), serverDashboard)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <DsbShellProvider community='home' demoMode initialData={serverDashboard}>
          {children}
        </DsbShellProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useDsbShell(), { wrapper })

    await waitFor(() => expect(result.current.title).toBe('local demo title'))
    expect(client.getQueryData<TDsb>(dsbKeys.slug('home'))?.title).toBe('server title')
    expect(result.current.original.title).toBe('local demo title')
  })
})
