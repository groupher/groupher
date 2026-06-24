import { fireEvent, render, screen } from '@testing-library/react'

import { DOC_COVER_LAYOUT, DOC_FAQ_LAYOUT } from '~/const/layout'

import { FIELD } from '../../../constant'
import DocCoverLayout from '../Cover'
import DocFaqLayout from '../Faq'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../logic/useDoc', () => ({
  default: () => ({
    docCoverLayout: DOC_COVER_LAYOUT.OUTLINE_COLUMNS,
    docFaqLayout: DOC_FAQ_LAYOUT.COLLAPSE,
    isTouched: false,
    isFaqTouched: false,
    saving: false,
    edit,
  }),
}))

vi.mock('../salon', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    divider: 'divider',
  }),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('../OutlineColumnsLayout', () => ({
  default: () => <span data-testid={`main-template-${DOC_COVER_LAYOUT.OUTLINE_COLUMNS}`} />,
}))

vi.mock('../OutlineTocLayout', () => ({
  default: () => <span data-testid={`main-template-${DOC_COVER_LAYOUT.OUTLINE_TOC}`} />,
}))

vi.mock('../BriefCardsLayout', () => ({
  default: () => <span data-testid={`main-template-${DOC_COVER_LAYOUT.BRIEF_CARDS}`} />,
}))

vi.mock('../TileCardsLayout', () => ({
  default: () => <span data-testid={`main-template-${DOC_COVER_LAYOUT.TILE_CARDS}`} />,
}))

vi.mock('../CoverCardsLayout', () => ({
  default: () => <span data-testid={`main-template-${DOC_COVER_LAYOUT.COVER_CARDS}`} />,
}))

vi.mock('../StackCardsLayout', () => ({
  default: () => <span data-testid={`main-template-${DOC_COVER_LAYOUT.STACK_CARDS}`} />,
}))

vi.mock('../FaqTemplate', () => ({
  default: ({ layout }: { layout: string }) => <span data-testid={`faq-template-${layout}`} />,
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
  default: ({ field }: { field: string }) => <div data-testid={`saving-bar-${field}`}>{field}</div>,
}))

describe('<DocLayout />', () => {
  beforeEach(() => {
    edit.mockClear()
  })

  it('renders doc cover layout group with its saving bar', () => {
    render(<DocCoverLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`saving-bar-${FIELD.DOC_COVER_LAYOUT}`)).toBeInTheDocument()
    expect(
      screen.getByTestId(`main-template-${DOC_COVER_LAYOUT.OUTLINE_COLUMNS}`),
    ).toBeInTheDocument()
  })

  it('renders faq layout group with its saving bar', () => {
    render(<DocFaqLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`saving-bar-${FIELD.DOC_FAQ_LAYOUT}`)).toBeInTheDocument()
    expect(screen.getByTestId(`faq-template-${DOC_FAQ_LAYOUT.COLLAPSE}`)).toBeInTheDocument()
  })

  it('updates doc cover layout when an option is clicked', () => {
    render(<DocCoverLayout />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2])

    expect(edit).toHaveBeenNthCalledWith(1, DOC_COVER_LAYOUT.OUTLINE_TOC, FIELD.DOC_COVER_LAYOUT)
  })

  it('updates faq layout when an option is clicked', () => {
    render(<DocFaqLayout />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2])

    expect(edit).toHaveBeenNthCalledWith(1, DOC_FAQ_LAYOUT.LEFT_RIGHT, FIELD.DOC_FAQ_LAYOUT)
  })

  it('keeps tile cards before cover cards in layout options', () => {
    render(<DocCoverLayout />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[4])
    fireEvent.click(buttons[5])

    expect(edit).toHaveBeenNthCalledWith(1, DOC_COVER_LAYOUT.TILE_CARDS, FIELD.DOC_COVER_LAYOUT)
    expect(edit).toHaveBeenNthCalledWith(2, DOC_COVER_LAYOUT.COVER_CARDS, FIELD.DOC_COVER_LAYOUT)
  })
})
