import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import { COMMUNITY_LAYOUT } from '~/const/layout'

import TopbarLayout from '..'
import { FIELD } from '../../../constant'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../logic/useTopbar', () => ({
  default: () => ({
    edit,
    enabled: true,
    isBgTouched: false,
    isLayoutTouched: false,
    saving: false,
    bg: 'black',
  }),
}))

vi.mock('../../../logic/useCommunityLayout', () => ({
  default: () => ({
    layout: COMMUNITY_LAYOUT.CLASSIC,
    edit: vi.fn(),
    isTouched: false,
    saving: false,
  }),
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({
    title: 'Home',
  }),
}))

vi.mock('../../CommunityLayout/CommunityLayoutPreviewContent', () => ({
  default: ({ layout, title }: { layout: string; title: string }) => (
    <div data-testid='banner-layout-preview' data-layout={layout} data-title={title} />
  ),
}))

vi.mock('../salon', () => ({
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
  default: ({ field, children }: { field: string; children?: ReactNode }) => (
    <div data-testid={`saving-bar-${field}`}>
      {field}
      {children}
    </div>
  ),
}))

vi.mock('~/widgets/ColorSelector', () => ({
  default: ({
    activeColor,
    onChange,
    children,
  }: {
    activeColor: string
    onChange: (color: string) => void
    children: ReactNode
  }) => (
    <button
      type='button'
      data-testid='color-selector'
      data-color={activeColor}
      onClick={() => onChange('red')}
    >
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
    expect(screen.getByTestId(`saving-bar-${FIELD.TOPBAR_ENABLED}`)).toBeInTheDocument()
    expect(screen.getByTestId(`saving-bar-${FIELD.TOPBAR_BG}`)).toBeInTheDocument()
    expect(screen.getByTestId('color-selector')).toHaveAttribute('data-color', 'black')
  })

  it('updates layout when none option is clicked', () => {
    render(<TopbarLayout />)

    fireEvent.click(screen.getByRole('button', { name: 'dsb.layout.topbar.option.none' }))

    expect(edit).toHaveBeenCalledWith(false, FIELD.TOPBAR_ENABLED)
  })

  it('updates topbar color while yes layout is active', () => {
    render(<TopbarLayout />)

    fireEvent.click(screen.getByTestId('color-selector'))

    expect(edit).toHaveBeenCalledWith('red', FIELD.TOPBAR_BG)
  })
})
