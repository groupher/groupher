import { fireEvent, render, screen } from '@testing-library/react'
import { DOC_FAQ_LAYOUT, DOC_LAYOUT } from '~/const/layout'
import { FIELD } from '../../constant'
import DocLayout from '.'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../logic/useDoc', () => ({
  default: () => ({
    docLayout: DOC_LAYOUT.BLOCKS,
    docFaqLayout: DOC_FAQ_LAYOUT.COLLAPSE,
    isTouched: false,
    isFaqTouched: false,
    saving: false,
    edit,
  }),
}))

vi.mock('../../salon/layout/doc_layout', () => ({
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

vi.mock('./MainTemplate', () => ({
  default: ({ layout }: { layout: string }) => <span data-testid={`main-template-${layout}`} />,
}))

vi.mock('./FaqTemplate', () => ({
  default: ({ layout }: { layout: string }) => <span data-testid={`faq-template-${layout}`} />,
}))

vi.mock('../../SectionLabel', () => ({
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

vi.mock('../../SavingBar', () => ({
  default: ({ field }: { field: string }) => <div data-testid={`saving-bar-${field}`}>{field}</div>,
}))

describe('<DocLayout />', () => {
  it('renders doc and faq layout groups with their saving bars', () => {
    render(<DocLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
    expect(buttons[3]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`saving-bar-${FIELD.DOC_LAYOUT}`)).toBeInTheDocument()
    expect(screen.getByTestId(`saving-bar-${FIELD.DOC_FAQ_LAYOUT}`)).toBeInTheDocument()
    expect(screen.getByTestId(`main-template-${DOC_LAYOUT.BLOCKS}`)).toBeInTheDocument()
    expect(screen.getByTestId(`faq-template-${DOC_FAQ_LAYOUT.COLLAPSE}`)).toBeInTheDocument()
  })

  it('updates doc and faq layout when options are clicked', () => {
    render(<DocLayout />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2])
    fireEvent.click(buttons[5])

    expect(edit).toHaveBeenNthCalledWith(1, DOC_LAYOUT.CARDS, FIELD.DOC_LAYOUT)
    expect(edit).toHaveBeenNthCalledWith(2, DOC_FAQ_LAYOUT.LEFT_RIGHT, FIELD.DOC_FAQ_LAYOUT)
  })
})
