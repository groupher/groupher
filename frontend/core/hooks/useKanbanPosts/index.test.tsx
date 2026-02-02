import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useKanbanPosts from '~/hooks/useKanbanPosts'

describe('useKanbanPosts', () => {
  it('reads kanban lists + resState', () => {
    const wrapper = makeStoreWrapper({
      articleList: true,
      articleListInit: {
        todo: { entries: [{ id: 'a1' }] },
        wip: { entries: [] },
        done: { entries: [{ id: 'a2' }] },
      },
    })

    const { result } = renderHook(() => useKanbanPosts(), { wrapper })
    expect(result.current.todo.entries).toHaveLength(1)
    expect(result.current.done.entries).toHaveLength(1)
    expect(result.current.resState).toBe('EMPTY')
  })
})
