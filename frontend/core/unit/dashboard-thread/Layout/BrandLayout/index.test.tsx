import { fireEvent, render, screen } from '@testing-library/react'
import { BRAND_LAYOUT } from '~/const/layout'
import { FIELD } from '../../constant'
import BrandLayout from '.'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ title: 'Groupher' }),
}))

vi.mock('../../logic/useBrand', () => ({
  default: () => ({
    edit,
    layout: BRAND_LAYOUT.BOTH,
    isTouched: false,
    saving: false,
  }),
}))

vi.mock('../../salon/layout/brand_layout', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    brand: 'brand',
    brandIcon: 'brand-icon',
    brandTitle: 'brand-title',
    divider: 'divider',
  }),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
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

vi.mock('~/icons/Brand', () => ({
  default: ({ className }: { className?: string }) => <svg data-testid='brand-icon' className={className} />,
}))

describe('<BrandLayout />', () => {
  it('renders three brand layout toggles with active state', () => {
    render(<BrandLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText('Groupher')).toHaveLength(2)
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.BRAND_LAYOUT)
  })

  it('updates brand layout when text option is clicked', () => {
    render(<BrandLayout />)

    fireEvent.click(screen.getAllByRole('button')[2])

    expect(edit).toHaveBeenCalledWith(BRAND_LAYOUT.TEXT, FIELD.BRAND_LAYOUT)
  })
})
