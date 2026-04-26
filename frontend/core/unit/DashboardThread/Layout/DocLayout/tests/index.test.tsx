import { fireEvent, render, screen } from '@testing-library/react'

import { DOC_COVER_LAYOUT, DOC_FAQ_LAYOUT } from '~/const/layout'

import DocLayout from '..'
import { FIELD } from '../../../constant'

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

vi.mock('../../../salon/layout/doc_layout', () => ({
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
  it('renders doc and faq layout groups with their saving bars', () => {
    render(<DocLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(9)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
    expect(buttons[6]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`saving-bar-${FIELD.DOC_COVER_LAYOUT}`)).toBeInTheDocument()
    expect(screen.getByTestId(`saving-bar-${FIELD.DOC_FAQ_LAYOUT}`)).toBeInTheDocument()
    expect(
      screen.getByTestId(`main-template-${DOC_COVER_LAYOUT.OUTLINE_COLUMNS}`),
    ).toBeInTheDocument()
    expect(screen.getByTestId(`faq-template-${DOC_FAQ_LAYOUT.COLLAPSE}`)).toBeInTheDocument()
  })

  it('updates doc and faq layout when options are clicked', () => {
    render(<DocLayout />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2])
    fireEvent.click(buttons[8])

    expect(edit).toHaveBeenNthCalledWith(1, DOC_COVER_LAYOUT.BRIEF_CARDS, FIELD.DOC_COVER_LAYOUT)
    expect(edit).toHaveBeenNthCalledWith(2, DOC_FAQ_LAYOUT.LEFT_RIGHT, FIELD.DOC_FAQ_LAYOUT)
  })

  it('keeps tile cards before cover cards in layout options', () => {
    render(<DocLayout />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[3])
    fireEvent.click(buttons[4])

    expect(edit).toHaveBeenNthCalledWith(1, DOC_COVER_LAYOUT.TILE_CARDS, FIELD.DOC_COVER_LAYOUT)
    expect(edit).toHaveBeenNthCalledWith(2, DOC_COVER_LAYOUT.COVER_CARDS, FIELD.DOC_COVER_LAYOUT)
  })
})
