import { useQuery } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import RealtimeOnline from '.'

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))
vi.mock('~/query', () => ({
  graphqlQueryOptions: () => ({ queryKey: ['analysis', 'active-visitors'] }),
}))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('./salon', () => ({
  default: () => ({ wrapper: 'wrapper', value: 'value', stale: 'stale', label: 'label' }),
}))

const mockedUseQuery = vi.mocked(useQuery)
const refetch = vi.fn()

const setVisibility = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('Dashboard Analytics RealtimeOnline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refetch.mockReset()
    mockedUseQuery.mockReturnValue({
      data: { analysisActiveVisitors: { visitors: 7 } },
      error: null,
      isFetching: false,
      refetch,
    } as never)
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('always refetches on mount and polls once per minute while visible', async () => {
    render(<RealtimeOnline community='home' />)

    expect(mockedUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, refetchOnMount: 'always' }),
    )

    await act(async () => vi.advanceTimersByTime(60_000))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('disables the query and polling while the document is hidden', async () => {
    render(<RealtimeOnline community='home' />)

    act(() => setVisibility('hidden'))
    expect(mockedUseQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }))

    await act(async () => vi.advanceTimersByTime(120_000))
    expect(refetch).not.toHaveBeenCalled()
  })

  it('keeps the last visitor value and marks it stale after a refresh error', async () => {
    const { rerender } = render(<RealtimeOnline community='home' />)
    expect(screen.getByText('7')).toBeInTheDocument()

    mockedUseQuery.mockReturnValue({
      data: { analysisActiveVisitors: { visitors: 7 } },
      error: new Error('offline'),
      isFetching: false,
      refetch,
    } as never)
    rerender(<RealtimeOnline community='home' />)

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('dsb.analysis.online_unavailable')).toBeInTheDocument()
  })

  it('shows unavailable when the initial request has no usable value', async () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      error: new Error('offline'),
      isFetching: false,
      refetch,
    } as never)

    render(<RealtimeOnline community='home' />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('dsb.analysis.online_unavailable')).toBeInTheDocument()
  })
})
