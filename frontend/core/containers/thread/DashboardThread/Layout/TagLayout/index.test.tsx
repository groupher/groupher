import { fireEvent, render, screen } from '@testing-library/react'
import { TAG_LAYOUT } from '~/const/layout'
import { FIELD } from '../../constant'
import TagLayout from '.'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../logic/useTags', () => ({
  default: () => ({
    edit,
    tagLayout: TAG_LAYOUT.HASH,
    tagLayoutTouched: false,
    saving: false,
  }),
}))

vi.mock('../../salon/layout/tag_layout', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    hashIcon: 'hash-icon',
    bar: 'bar',
    circle: 'circle',
  }),
  cnMerge: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
}))

vi.mock('../../SectionLabel', () => ({
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

vi.mock('../../SavingBar', () => ({
  default: ({ field }: { field: string }) => <div data-testid='saving-bar'>{field}</div>,
}))

vi.mock('~/icons/HashTag', () => ({
  default: ({ className }: { className?: string }) => (
    <svg data-testid='hash-icon' className={className} />
  ),
}))

describe('<TagLayout />', () => {
  it('renders two toggle buttons with current active state', () => {
    render(<TagLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAttribute('type', 'button')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.TAG_LAYOUT)
  })

  it('updates tag layout when another option is clicked', () => {
    render(<TagLayout />)

    fireEvent.click(screen.getByRole('button', { name: 'dsb.layout.tag.option.dot' }))

    expect(edit).toHaveBeenCalledWith(TAG_LAYOUT.DOT, FIELD.TAG_LAYOUT)
  })
})
