import { fireEvent, render, screen } from '@testing-library/react'

import { INLINE_TAG_LAYOUT } from '~/const/layout'

import InlineTagLayout from '..'
import { FIELD } from '../../../constant'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../logic/useTags', () => ({
  default: () => ({
    edit,
    inlineTagLayout: INLINE_TAG_LAYOUT.MORANDI,
    inlineTagLayoutTouched: false,
    saving: false,
  }),
}))

vi.mock('../salon', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
  }),
  cnMerge: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
}))

vi.mock('../TagItem', () => ({
  default: ({ tag, layout }: { tag: { title: string }; layout: string }) => (
    <span data-testid={`tag-item-${layout}`}>{tag.title}</span>
  ),
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

describe('<InlineTagLayout />', () => {
  it('renders five layout toggles with current active state', () => {
    render(<InlineTagLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[4]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.INLINE_TAG_LAYOUT)
  })

  it('updates inline tag layout when another option is clicked', () => {
    render(<InlineTagLayout />)

    fireEvent.click(screen.getAllByRole('button')[3])

    expect(edit).toHaveBeenCalledWith(INLINE_TAG_LAYOUT.BORDER, FIELD.INLINE_TAG_LAYOUT)
  })
})
