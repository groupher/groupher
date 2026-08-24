import { useQuery } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

import TrafficPanel from '.'

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))
vi.mock('~/query', () => ({
  graphqlQueryOptions: () => ({ queryKey: ['analysis', 'traffic'] }),
}))
vi.mock('./salon', () => ({
  default: () => ({
    wrapper: 'wrapper',
    title: 'title',
    state: 'state',
    error: 'error',
    grid: 'grid',
    weekday: 'weekday',
    hour: 'hour',
    cell: 'cell',
    dot: () => 'dot',
  }),
}))

const mockedUseQuery = vi.mocked(useQuery)

describe('Dashboard Analytics TrafficPanel', () => {
  beforeEach(() => {
    mockedUseQuery.mockReturnValue({ data: undefined, error: null, isFetching: false } as never)
  })

  it('keeps the network query disabled when demo data owns the view', () => {
    render(
      <TrafficPanel
        community='home'
        days={7}
        demoData={
          {
            traffic: { status: 'ok', timezone: 'UTC', cells: [], error: null },
          } as never
        }
      />,
    )

    expect(mockedUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })
})
