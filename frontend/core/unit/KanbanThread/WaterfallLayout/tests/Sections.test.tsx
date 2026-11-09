import { render, screen } from '@testing-library/react'

import { KANBAN_BOARD } from '~/const/thread'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import type { TKanbanPage } from '~/hooks/useKanbanTickets'

import Sections from '../Sections'

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

vi.mock('../../salon/waterfall_layout/sections', () => ({
  default: () => ({
    wrapper: 'wrapper',
    column: 'column',
    backlogHead: 'backlogHead',
    todoHead: 'todoHead',
    wipHead: 'wipHead',
    doneHead: 'doneHead',
    rejectedHead: 'rejectedHead',
    backlogIcon: 'backlogIcon',
    todoIcon: 'todoIcon',
    wipIcon: 'wipIcon',
    doneIcon: 'doneIcon',
    rejectedIcon: 'rejectedIcon',
    label: 'label',
    count: 'count',
    backlogText: 'backlogText',
    todoText: 'todoText',
    wipText: 'wipText',
    doneText: 'doneText',
    rejectedText: 'rejectedText',
    arrowIcon: 'arrowIcon',
    content: 'content',
  }),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('../../KanbanItem', () => ({
  default: () => <div>item</div>,
}))

vi.mock('../../KanbanItem/EmptyItem', () => ({
  default: () => <div>empty</div>,
}))

describe('<Sections />', () => {
  it('renders only configured boards', () => {
    const Wrapper = makeStoreWrapper()
    render(
      <Wrapper>
        <Sections />
      </Wrapper>,
    )

    expect(screen.getByText('article.status.todo')).toBeInTheDocument()
    expect(screen.getByText('article.status.done')).toBeInTheDocument()
    expect(screen.queryByText('article.status.wip')).not.toBeInTheDocument()
  })
})
