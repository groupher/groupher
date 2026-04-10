import { fireEvent, render, screen } from '@testing-library/react'
import { KANBAN_BOARD } from '~/const/thread'
import { FIELD } from '../../../constant'
import Boards from '../Boards'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({
    t: (key: string) =>
      (
        ({
          'article.state.backlog': 'Backlog',
          'article.state.todo': 'Todo',
          'article.state.wip': 'In progress',
          REJECTED: 'Rejected',
          'article.state.done': 'Done',
        }) as Record<string, string>
      )[key] || key,
  }),
}))

vi.mock('~/hooks/usePrimaryColor', () => ({
  default: () => 'BLACK',
}))

vi.mock('~/hooks/useTwBelt', () => ({
  default: () => ({
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
    fg: (token: string) => `fg-${token}`,
    fill: (token: string) => `fill-${token}`,
    rainbow: (color: string, token: string) => `rainbow-${color}-${token}`,
  }),
}))

vi.mock('../../../logic/useKanban', () => ({
  default: () => ({
    kanbanBoards: [KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE],
    isKanbanBoardsTouched: false,
    saving: false,
    edit,
  }),
}))

vi.mock('../../../salon/layout/kanban_layout/boards', () => ({
  default: () => ({
    select: 'select',
    layout: 'layout',
    block: 'block',
  }),
}))

vi.mock('../../../SectionLabel', () => ({
  default: ({ title, desc }: { title: string; desc: string }) => (
    <div>
      <span>{title}</span>
      <span>{desc}</span>
    </div>
  ),
}))

vi.mock('../../../SavingBar', () => ({
  default: ({ field }: { field: string }) => <div data-testid='saving-bar'>{field}</div>,
}))

vi.mock('~/widgets/Checker', () => ({
  default: () => null,
}))

vi.mock('~/icons/CheckBold', () => ({
  default: ({ className }: { className?: string }) => (
    <svg data-testid='check-icon' className={className} />
  ),
}))

describe('<Boards />', () => {
  beforeEach(() => {
    edit.mockClear()
  })

  it('renders five board toggles and binds save bar to kanban boards field', () => {
    render(<Boards />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[3]).toHaveAttribute('aria-pressed', 'false')
    expect(buttons[4]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.KANBAN_BOARDS)
  })

  it('adds unchecked board into kanban boards list', () => {
    render(<Boards />)

    fireEvent.click(screen.getByRole('button', { name: /Backlog/i }))

    expect(edit).toHaveBeenCalledWith(
      [KANBAN_BOARD.BACKLOG, KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE],
      FIELD.KANBAN_BOARDS,
    )
  })

  it('removes checked board from kanban boards list', () => {
    render(<Boards />)

    fireEvent.click(screen.getByRole('button', { name: /Todo/i }))

    expect(edit).toHaveBeenCalledWith([KANBAN_BOARD.WIP, KANBAN_BOARD.DONE], FIELD.KANBAN_BOARDS)
  })
})
