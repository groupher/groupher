import { fireEvent, render, screen } from '@testing-library/react'

import { KANBAN_CARD_LAYOUT } from '~/const/layout'

import { FIELD } from '../../../constant'
import ItemCardLayout from '../ItemCardLayout'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../logic/useKanban', () => ({
  default: () => ({
    kanbanCardLayout: KANBAN_CARD_LAYOUT.SIMPLE,
    isKanbanCardLayoutTouched: false,
    saving: false,
    edit,
  }),
}))

vi.mock('../salon/item_card_layout', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    bar: 'bar',
    icon: 'icon',
    userAvatar: 'user-avatar',
  }),
  cnMerge: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
}))

vi.mock('../../../SectionLabel', () => ({
  default: ({ title, desc }: { title: string; desc: string }) => (
    <div>
      <span>{title}</span>
      <span>{desc}</span>
    </div>
  ),
}))

vi.mock('~/widgets/CheckLabel', () => ({
  default: ({ title, active }: { title: string; active: boolean }) => (
    <span data-active={active}>{title}</span>
  ),
}))

vi.mock('../../../SavingBar', () => ({
  default: ({ field }: { field: string }) => <div data-testid='saving-bar'>{field}</div>,
}))

vi.mock('~/icons/Comment', () => ({
  default: ({ className }: { className?: string }) => (
    <svg data-testid='comment-icon' className={className} />
  ),
}))

vi.mock('~/icons/Upvote', () => ({
  default: ({ className }: { className?: string }) => (
    <svg data-testid='upvote-icon' className={className} />
  ),
}))

describe('<ItemCardLayout />', () => {
  it('renders two kanban card layout toggles with active state', () => {
    render(<ItemCardLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.KANBAN_CARD_LAYOUT)
  })

  it('updates card layout when full option is clicked', () => {
    render(<ItemCardLayout />)

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(edit).toHaveBeenCalledWith(KANBAN_CARD_LAYOUT.FULL, FIELD.KANBAN_CARD_LAYOUT)
  })
})
