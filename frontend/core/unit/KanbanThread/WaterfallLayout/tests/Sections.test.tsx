import { render, screen } from '@testing-library/react'

import { KANBAN_BOARD } from '~/const/thread'
import type { TPagedPosts } from '~/spec'

import Sections from '../Sections'

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
    render(<Sections />)

    expect(screen.getByText('article.state.todo')).toBeInTheDocument()
    expect(screen.getByText('article.state.done')).toBeInTheDocument()
    expect(screen.queryByText('article.state.backlog')).not.toBeInTheDocument()
    expect(screen.queryByText('article.state.wip')).not.toBeInTheDocument()
    expect(screen.queryByText('article.state.reject')).not.toBeInTheDocument()
  })
})
