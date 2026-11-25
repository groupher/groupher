import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { FIELDS } from '~/constant/dsb-fields'
import type { TDsb } from '~/spec'
import { useDsbShellStore } from '~/stores/dsbShell/hooks'
import DsbShellProvider from '~/stores/dsbShell/provider'
import { FIELD } from '~/unit/DsbThread/constant'

import useDsbFieldSave from './useDsbFieldSave'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))

vi.mock('~/query/mutation/useDsbSaveRunner', () => ({
  default: () => ({ save: mocks.save, isPending: false, error: null }),
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/hooks/useDsbTab', () => ({ default: () => ({ subTab: null }) }))

describe('useDsbFieldSave FAQ completion', () => {
  beforeEach(() => mocks.save.mockReset())

  const renderEditor = () => {
    const client = new QueryClient()
    const initialData = { ...FIELDS } as TDsb
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <DsbShellProvider community='home' demoMode={false} initialData={initialData}>
          {children}
        </DsbShellProvider>
      </QueryClientProvider>
    )

    return renderHook(() => ({ ...useDsbFieldSave(), store: useDsbShellStore() }), { wrapper })
  }

  it('clears the FAQ save zone after a successful save in the same editor session', () => {
    const { result } = renderEditor()
    let afterConfirmed: ((data: unknown) => void) | undefined

    act(() => {
      result.current.store.setDocFaqSaveZone({ type: 'title' })
      result.current.mutation(FIELD.DOC_FAQ)
      afterConfirmed = mocks.save.mock.calls[0][0].afterConfirmed
    })
    act(() => afterConfirmed?.(null))

    expect(result.current.store.docFaqSaveZone).toBeNull()
  })

  it('keeps a newer FAQ save zone when an older request completes', () => {
    const { result } = renderEditor()
    let afterConfirmed: ((data: unknown) => void) | undefined

    act(() => {
      result.current.store.setDocFaqSaveZone({ type: 'title' })
      result.current.mutation(FIELD.DOC_FAQ)
      afterConfirmed = mocks.save.mock.calls[0][0].afterConfirmed
      result.current.store.setDocFaqSaveZone({ type: 'desc' })
    })
    act(() => afterConfirmed?.(null))

    expect(result.current.store.docFaqSaveZone).toEqual({ type: 'desc' })
  })
})
