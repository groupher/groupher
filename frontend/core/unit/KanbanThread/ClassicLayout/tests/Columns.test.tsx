import { renderHook } from '@testing-library/react'

import { KANBAN_BOARD } from '~/const/thread'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import type { TKanbanPage } from '~/hooks/useKanbanTickets'

import { useColumnsData } from '../Columns'

const emptyTickets: TKanbanPage = {
  entries: [],
  mode: 'load_more',
  setPage: vi.fn(),
  next: vi.fn(),
  retry: vi.fn(),
  pending: false,
  error: null,
}

vi.mock('~/hooks/useKanbanTickets', () => ({
  default: () => ({
    todo: emptyTickets,
    wip: emptyTickets,
    done: emptyTickets,
  }),
}))

vi.mock('~/hooks/useKanbanBgColors', () => ({
  default: () => ['neutral', 'neutral', 'neutral'],
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

vi.mock('../../salon/classic_layout/columns', () => ({
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

vi.mock('../../KanbanItem', () => ({
  default: () => <div>item</div>,
}))

vi.mock('../../KanbanItem/EmptyItem', () => ({
  default: () => <div>empty</div>,
}))

describe('useColumnsData', () => {
  it('returns only configured boards', () => {
    const { result } = renderHook(() => useColumnsData(), {
      wrapper: makeStoreWrapper(),
    })

    expect(result.current.map((column) => column.key)).toEqual(['todo', 'done'])
  })
})
