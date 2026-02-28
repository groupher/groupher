import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useKanbanPosts from '~/hooks/useKanbanPosts'

describe('useKanbanPosts', () => {
  it('reads kanban lists + resState', () => {
    const wrapper = makeStoreWrapper({
      articleList: true,
      articleListInit: {
        backlog: { entries: [{ id: 'a0' }] },
        todo: { entries: [{ id: 'a1' }] },
        wip: { entries: [] },
        done: { entries: [{ id: 'a2' }] },
        rejected: { entries: [{ id: 'a3' }] },
      },
    })

    const { result } = renderHook(() => useKanbanPosts(), { wrapper })
    expect(result.current.backlog.entries).toHaveLength(1)
    expect(result.current.todo.entries).toHaveLength(1)
    expect(result.current.done.entries).toHaveLength(1)
    expect(result.current.rejected.entries).toHaveLength(1)
    expect(result.current.resState).toBe('EMPTY')
  })
})
