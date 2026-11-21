import { fireEvent, render, screen } from '@testing-library/react'

import Pagi from '.'
import CursorPagination from './CursorPagination'
import PaginationError from './PaginationError'

it('renders offset controls without community providers and validates page input', () => {
  const change = vi.fn()
  render(
    <Pagi
      pageInfo={{
        __typename: 'OffsetPageInfo',
        page: 2,
        size: 10,
        totalCount: 30,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: true,
      }}
      labels={{ previousPage: 'Previous page', nextPage: 'Next page', pageNumber: 'Page number' }}
      onChange={change}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(change).toHaveBeenLastCalledWith(3)
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } })
  expect(change).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } })
  expect(change).toHaveBeenLastCalledWith(1)
})

it('renders cursor loading and retry without community providers and blocks duplicate requests', () => {
  const load = vi.fn()
  const retry = vi.fn()
  const props = { mode: 'LOAD_MORE' as const, hasNextPage: true, onLoadMore: load, onRetry: retry }
  const { rerender } = render(<CursorPagination {...props} isLoading />)
  fireEvent.click(screen.getByRole('button'))
  expect(load).not.toHaveBeenCalled()
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  rerender(<CursorPagination {...props} isLoading={false} error={new Error('failed')} />)
  fireEvent.click(screen.getByRole('button', { name: '重试下一页加载' }))
  expect(retry).toHaveBeenCalledTimes(1)
  rerender(<PaginationError isRetrying={false} onRetry={retry} />)
  fireEvent.click(screen.getByRole('button', { name: '重试列表加载' }))
  expect(retry).toHaveBeenCalledTimes(2)
})
