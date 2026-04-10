import { fireEvent, render, screen } from '@testing-library/react'
import { CHANGELOG_LAYOUT } from '~/const/layout'
import { FIELD } from '../../../constant'
import ChangelogLayout from '..'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../logic/useChangelog', () => ({
  default: () => ({
    edit,
    layout: CHANGELOG_LAYOUT.CLASSIC,
    isTouched: false,
    saving: false,
  }),
}))

vi.mock('../../../salon/layout/changelog_layout', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    cover: 'cover',
    bar: 'bar',
    thumbnil: 'thumbnail',
  }),
  cnMerge: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
}))

vi.mock('../../../SectionLabel', () => ({
  default: ({ title, desc, detailText }: { title: string; desc: string; detailText?: string }) => (
    <div>
      <span>{title}</span>
      <span>{desc}</span>
      {detailText ? <span>{detailText}</span> : null}
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

describe('<ChangelogLayout />', () => {
  it('renders two changelog layout toggles with active state', () => {
    render(<ChangelogLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.CHANGELOG_LAYOUT)
  })

  it('updates changelog layout when simple option is clicked', () => {
    render(<ChangelogLayout />)

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(edit).toHaveBeenCalledWith(CHANGELOG_LAYOUT.SIMPLE, FIELD.CHANGELOG_LAYOUT)
  })
})
