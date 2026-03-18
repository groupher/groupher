import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TOPBAR_LAYOUT } from '~/const/layout'
import { FIELD } from '../../constant'
import TopbarLayout from '.'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../logic/useTopbar', () => ({
  default: () => ({
    edit,
    layout: TOPBAR_LAYOUT.YES,
    isBgTouched: false,
    isLayoutTouched: false,
    saving: false,
    bg: 'black',
  }),
}))

vi.mock('../../salon/layout/topbar_layout', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    topBar: 'topbar',
    bar: 'bar',
    bgWrapper: 'bg-wrapper',
    bgLabel: 'bg-label',
    theColor: 'the-color',
  }),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
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
  default: ({ field, children }: { field: string; children?: ReactNode }) => (
    <div data-testid={`saving-bar-${field}`}>
      {field}
      {children}
    </div>
  ),
}))

vi.mock('~/widgets/ColorSelector', () => ({
  default: ({ activeColor, onChange, children }: { activeColor: string; onChange: (color: string) => void; children: ReactNode }) => (
    <button type='button' data-testid='color-selector' data-color={activeColor} onClick={() => onChange('red')}>
      {children}
    </button>
  ),
}))

describe('<TopbarLayout />', () => {
  it('renders topbar options and color settings for the active yes layout', () => {
    render(<TopbarLayout />)

    expect(screen.getByRole('button', { name: 'dsb.layout.topbar.option.with' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'dsb.layout.topbar.option.none' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByTestId(`saving-bar-${FIELD.TOPBAR_LAYOUT}`)).toBeInTheDocument()
    expect(screen.getByTestId(`saving-bar-${FIELD.TOPBAR_BG}`)).toBeInTheDocument()
    expect(screen.getByTestId('color-selector')).toHaveAttribute('data-color', 'black')
  })

  it('updates layout and topbar color through interactions', () => {
    render(<TopbarLayout />)

    fireEvent.click(screen.getByRole('button', { name: 'dsb.layout.topbar.option.none' }))
    fireEvent.click(screen.getByTestId('color-selector'))

    expect(edit).toHaveBeenNthCalledWith(1, TOPBAR_LAYOUT.NO, FIELD.TOPBAR_LAYOUT)
    expect(edit).toHaveBeenNthCalledWith(2, 'red', FIELD.TOPBAR_BG)
  })
})
