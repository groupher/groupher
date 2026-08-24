import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useKanbanPosts from '~/hooks/useKanbanPosts'

describe('useKanbanPosts', () => {
  it('reads kanban lists + resState', () => {
    const StoreWrapper = makeStoreWrapper({
      articleList: true,
    })
    const queryClient = new QueryClient()
    queryClient.setQueryData(['article', 'kanban', 'acme'], {
      backlog: { entries: [{ id: 'a0' }] },
      todo: { entries: [{ id: 'a1' }] },
      wip: { entries: [] },
      done: { entries: [{ id: 'a2' }] },
      rejected: { entries: [{ id: 'a3' }] },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <StoreWrapper>{children}</StoreWrapper>
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useKanbanPosts(), { wrapper })
    expect(result.current.backlog.entries).toHaveLength(1)
    expect(result.current.todo.entries).toHaveLength(1)
    expect(result.current.done.entries).toHaveLength(1)
    expect(result.current.rejected.entries).toHaveLength(1)
    expect(result.current.resState).toBe('DONE')
  })
})
