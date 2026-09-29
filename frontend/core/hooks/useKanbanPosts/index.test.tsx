import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useKanbanPosts from '~/hooks/useKanbanPosts'
import AccountStoreProvider from '~/stores/account/provider'

describe('useKanbanPosts', () => {
  it('reads kanban lists + resState', () => {
    const queryClient = new QueryClient()
    const article = (innerId: string) => ({
      innerId,
      community: { slug: 'acme' },
      meta: { thread: 'POST' },
    })
    queryClient.setQueryData(['article', 'kanban', 'acme'], {
      backlog: { entries: [article('a0')] },
      todo: { entries: [article('a1')] },
      wip: { entries: [] },
      done: { entries: [article('a2')] },
      rejected: { entries: [article('a3')] },
    })
    const StoreWrapper = makeStoreWrapper({
      articleList: true,
      queryClient,
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AccountStoreProvider initData={{ loading: false, user: null }}>
          <StoreWrapper>{children}</StoreWrapper>
        </AccountStoreProvider>
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
