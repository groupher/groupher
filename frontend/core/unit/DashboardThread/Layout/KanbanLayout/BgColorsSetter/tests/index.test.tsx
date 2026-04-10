import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { COLOR } from '~/const/colors'
import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import { KANBAN_LAYOUT } from '~/const/layout'
import { KANBAN_BOARD } from '~/const/thread'
import { FIELD } from '../../../../constant'
import BgColorsSetter from '..'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../../logic/useKanban', () => ({
  default: () => ({
    kanbanLayout: KANBAN_LAYOUT.CLASSIC,
    kanbanBoards: [KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE],
    kanbanBgColors: [COLOR.BLACK, COLOR.YELLOW, COLOR.PURPLE, COLOR.GREEN, COLOR.RED],
    isKanbanColorsTouched: false,
    saving: false,
    edit,
  }),
}))

vi.mock('../../../../salon/layout/kanban_layout/bg_colors_setter', () => ({
  default: () => ({
    colorsWrapper: 'colorsWrapper',
    preset: 'preset',
    colorBall: 'colorBall',
    backlogBall: 'backlogBall',
    todoBall: 'todoBall',
    wipBall: 'wipBall',
    doneBall: 'doneBall',
    rejectedBall: 'rejectedBall',
    action: 'action',
    resetIcon: 'resetIcon',
  }),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('../ClassicLayout', () => ({
  default: ({ activeBoards }: { activeBoards: string[] }) => (
    <div data-testid='classic-preview'>{activeBoards.join(',')}</div>
  ),
}))

vi.mock('../WaterfallLayout', () => ({
  default: () => <div data-testid='waterfall-preview' />,
}))

vi.mock('../../../../SectionLabel', () => ({
  default: ({ title, desc }: { title: string; desc: string }) => (
    <div>
      <span>{title}</span>
      <span>{desc}</span>
    </div>
  ),
}))

vi.mock('../../../../SavingBar', () => ({
  default: ({ field }: { field: string }) => <div data-testid={`saving-bar-${field}`}>{field}</div>,
}))

vi.mock('~/widgets/ColorSelector', () => ({
  default: ({ activeColor, children }: { activeColor: string; children: ReactNode }) => (
    <div data-testid='color-selector' data-color={activeColor}>
      {children}
    </div>
  ),
}))

describe('<BgColorsSetter />', () => {
  beforeEach(() => {
    edit.mockClear()
  })

  it('shows only enabled board color selectors and preview boards', () => {
    render(<BgColorsSetter />)

    expect(screen.getAllByTestId('color-selector')).toHaveLength(3)
    expect(screen.getByTestId('classic-preview')).toHaveTextContent('todo,wip,done')
  })

  it('resets only enabled board colors and preserves hidden board colors', () => {
    render(<BgColorsSetter />)

    fireEvent.click(screen.getByRole('button', { name: 'dsb.layout.kanban.bg.reset' }))

    expect(edit).toHaveBeenCalledWith(
      [COLOR.BLACK, INIT_KANBAN_COLORS[1], INIT_KANBAN_COLORS[2], INIT_KANBAN_COLORS[3], COLOR.RED],
      FIELD.KANBAN_BG_COLORS,
    )
  })
})
