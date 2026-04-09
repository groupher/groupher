import { renderHook } from '@testing-library/react'
import { KANBAN_BOARD } from '~/const/thread'
import type { TPagedPosts } from '~/spec'
import { useColumnsData } from './Columns'

const emptyPosts: TPagedPosts = {
  entries: [],
  totalCount: 0,
  pageNumber: 1,
  pageSize: 20,
  totalPages: 1,
}

vi.mock('~/hooks/useKanbanPosts', () => ({
  default: () => ({
    backlog: emptyPosts,
    todo: emptyPosts,
    wip: emptyPosts,
    done: emptyPosts,
    rejected: emptyPosts,
  }),
}))

vi.mock('~/hooks/useLayout', () => ({
  default: () => ({
    kanbanBoards: [KANBAN_BOARD.TODO, KANBAN_BOARD.DONE],
  }),
}))

vi.mock('~/hooks/useNameAlias', () => ({
  default: () => ({}),
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../salon/classic_layout/columns', () => ({
  default: () => ({
    backlogIcon: 'backlogIcon',
    todoIcon: 'todoIcon',
    wipIcon: 'wipIcon',
    doneIcon: 'doneIcon',
    rejectedIcon: 'rejectedIcon',
    backlogBody: 'backlogBody',
    todoBody: 'todoBody',
    wipBody: 'wipBody',
    doneBody: 'doneBody',
    rejectedBody: 'rejectedBody',
    header: 'header',
    label: 'label',
    subTitle: 'subTitle',
    columnBase: 'columnBase',
    headerRowViewport: 'headerRowViewport',
    columnsTrack: 'columnsTrack',
    scrollColumn: 'scrollColumn',
    scroller: 'scroller',
  }),
}))

vi.mock('../KanbanItem', () => ({
  default: () => <div>item</div>,
}))

vi.mock('../KanbanItem/EmptyItem', () => ({
  default: () => <div>empty</div>,
}))

describe('useColumnsData', () => {
  it('returns only configured boards', () => {
    const { result } = renderHook(() => useColumnsData())

    expect(result.current.map((column) => column.key)).toEqual(['todo', 'done'])
  })
})
