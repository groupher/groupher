import { fireEvent, render, screen } from '@testing-library/react'

import { COMMUNITY_LAYOUT, NAV_ACTIVE_LAYOUT } from '~/const/layout'

import NavActiveLayout from '..'
import { FIELD } from '../../../constant'

const edit = vi.fn()

const hookState = {
  edit,
  layout: NAV_ACTIVE_LAYOUT.TEXT,
  communityLayout: COMMUNITY_LAYOUT.CLASSIC,
  isTouched: false,
  isSupported: true,
  saving: false,
}

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/hooks/useNavActiveLayoutSalon', () => ({
  default: () => ({
    item: 'active-item',
    icon: 'active-icon',
  }),
}))

vi.mock('../../../logic/useNavActiveLayout', () => ({
  default: () => hookState,
}))

vi.mock('../salon', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    preview: 'preview',
    previewItem: 'preview-item',
  }),
  cnMerge: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
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

describe('<NavActiveLayout />', () => {
  afterEach(() => {
    hookState.layout = NAV_ACTIVE_LAYOUT.TEXT
    hookState.isSupported = true
    edit.mockClear()
  })

  it('renders three layout toggles with active state', () => {
    render(<NavActiveLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.NAV_ACTIVE_LAYOUT)
  })

  it('updates nav active layout when another option is clicked', () => {
    render(<NavActiveLayout />)

    fireEvent.click(screen.getAllByRole('button')[2])

    expect(edit).toHaveBeenCalledWith(NAV_ACTIVE_LAYOUT.SOFT_BG, FIELD.NAV_ACTIVE_LAYOUT)
  })

  it('does not render when current community layout is unsupported', () => {
    hookState.isSupported = false

    const { container } = render(<NavActiveLayout />)

    expect(container).toBeEmptyDOMElement()
  })
})
