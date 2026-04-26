import { fireEvent, render, screen } from '@testing-library/react'

import { AVATAR_LAYOUT } from '~/const/layout'

import AvatarLayout from '..'
import { FIELD } from '../../../constant'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../logic/useAvatar', () => ({
  default: () => ({
    edit,
    layout: AVATAR_LAYOUT.SQUARE,
    isTouched: false,
    saving: false,
  }),
}))

vi.mock('../../../salon/layout/avatar_layout', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    avatar: 'avatar',
    blue: 'blue',
    green: 'green',
    red: 'red',
    orange: 'orange',
    purple: 'purple',
    divider: 'divider',
    list: 'list',
  }),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
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

describe('<AvatarLayout />', () => {
  it('renders two avatar layout toggles with active state', () => {
    render(<AvatarLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.AVATAR_LAYOUT)
  })

  it('updates avatar layout when circle option is clicked', () => {
    render(<AvatarLayout />)

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(edit).toHaveBeenCalledWith(AVATAR_LAYOUT.CIRCLE, FIELD.AVATAR_LAYOUT)
  })
})
