import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import Tabs from '.'
import type { TSideTreeController, TSideTreeTab } from '../SideTree/spec'

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({
    locale: 'en',
    t: (key: string) =>
      ({
        'dsb.doc.tabs.settings': 'Manage tabs',
        'dsb.doc.tabs.manage': 'Manage tabs',
        'dsb.doc.tabs.close_settings': 'Close tab settings',
        'dsb.doc.tabs.rename': 'Rename tab',
        'dsb.doc.tabs.delete': 'Delete tab',
        'dsb.doc.tabs.drag': 'Drag to reorder tab',
        'dsb.doc.tabs.save_sort': 'Save the new order?',
        'dsb.doc.empty_action.add_tab': 'Add Tab',
      })[key] || key,
  }),
}))

vi.mock('~/ui/Drawer', () => ({
  default: ({ children, show }: { children: ReactNode; show: boolean }) =>
    show ? <aside aria-label='Tab settings drawer'>{children}</aside> : null,
}))

vi.mock('~/ui/Modal', () => ({
  default: ({ children, show }: { children: ReactNode; show: boolean }) =>
    show ? <div role='dialog'>{children}</div> : null,
}))

vi.mock('~/ui/Buttons/Button', () => ({
  default: ({
    ariaLabel,
    children,
    onClick,
  }: {
    ariaLabel?: string
    children: ReactNode
    onClick?: () => void
  }) => (
    <button type='button' aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('~/ui/IconHub', () => ({ default: () => null }))

vi.mock('~/unit/DashboardThread/SavingBar', () => ({
  default: ({ children, disabled, isTouched, onCancel, onConfirm }) => {
    if (!isTouched) return children ?? null

    return (
      <div data-testid='saving-bar'>
        {children}
        <button type='button' onClick={onCancel}>
          Cancel
        </button>
        <button type='button' disabled={disabled} onClick={onConfirm}>
          Save
        </button>
      </div>
    )
  },
}))

vi.mock('./salon', () => ({
  default: () => ({
    wrapper: '',
    tabsViewport: '',
    settingsButton: '',
    settingsIcon: '',
  }),
}))

vi.mock('./SettingsDrawer/salon', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
  default: () => new Proxy<Record<string, string>>({}, { get: () => '' }),
}))

vi.mock('~/ui/Switcher/Tabs', () => ({
  default: ({ activeKey, items, onChange }) => (
    <nav aria-label='Switcher tabs'>
      {items.map((item) => (
        <button
          key={item.slug}
          type='button'
          aria-current={item.slug === activeKey ? 'page' : undefined}
          onClick={() => onChange(item.slug)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  ),
}))

const noop = (): void => undefined

const makeTab = (id: string, title: string): TSideTreeTab => ({
  id,
  title,
  groups: [],
  pins: [],
})

const makeController = (
  tabs: TSideTreeTab[],
  patch: Partial<TSideTreeController> = {},
): TSideTreeController => ({
  tabs,
  activeTabId: tabs[0]?.id ?? null,
  pins: tabs[0]?.pins ?? [],
  groups: [],
  treeState: null,
  stagedEvents: [],
  trashItems: [],
  trashLoading: false,
  activeId: null,
  editingTarget: null,
  coverWarning: null,
  activate: noop,
  activateTab: noop,
  addPin: noop,
  addTab: noop,
  deleteTab: noop,
  renameTab: noop,
  reorderTabs: noop,
  addGroup: noop,
  addNestedGroup: noop,
  addChild: noop,
  clearCoverWarning: noop,
  deleteGroup: noop,
  toggleGroup: noop,
  toggleCoverGroup: noop,
  renameGroup: noop,
  renameChild: noop,
  renameLink: noop,
  savePin: noop,
  deletePin: noop,
  cancelEdit: noop,
  edit: noop,
  handleChildAction: noop,
  updateChildStyle: noop,
  updatePinStyle: noop,
  patchChild: noop,
  reload: noop,
  reloadTrash: noop,
  reorderGroups: noop,
  ...patch,
})

describe('docs editor tabs', () => {
  it('hides the tabs row and settings when there are no tabs', () => {
    render(<Tabs controller={makeController([])} showTabs={false} submenuCollapsed={false} />)

    expect(screen.queryByRole('button', { name: 'Manage tabs' })).not.toBeInTheDocument()
  })

  it('shows the tabs row and settings when there is one tab', () => {
    render(
      <Tabs
        controller={makeController([makeTab('intro', 'Introduction')])}
        showTabs
        submenuCollapsed={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'Manage tabs' })).toBeInTheDocument()
  })

  it('keeps tab switching read-only and moves management into the drawer', () => {
    const activateTab = vi.fn()
    const controller = makeController([makeTab('intro', 'Introduction'), makeTab('api', 'API')], {
      activateTab,
    })

    render(<Tabs controller={controller} showTabs submenuCollapsed={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'API' }))
    expect(activateTab).toHaveBeenCalledWith('api')

    fireEvent.click(screen.getByRole('button', { name: 'Manage tabs' }))
    const drawer = screen.getByRole('complementary', { name: 'Tab settings drawer' })

    expect(within(drawer).getByText('Introduction')).toBeInTheDocument()
    expect(within(drawer).getByText('API')).toBeInTheDocument()
    expect(within(drawer).getAllByRole('button', { name: /Rename tab/ })).toHaveLength(2)
    expect(within(drawer).getAllByRole('button', { name: /Delete tab/ })).toHaveLength(2)
    expect(within(drawer).getAllByRole('button', { name: /Drag to reorder tab/ })).toHaveLength(2)
    expect(within(drawer).getByRole('button', { name: 'Add Tab' })).toBeInTheDocument()
  })

  it('stages rename and add actions behind SavingBar controls', () => {
    const addTab = vi.fn()
    const renameTab = vi.fn()
    const controller = makeController([makeTab('intro', 'Introduction'), makeTab('api', 'API')], {
      addTab,
      renameTab,
    })

    render(<Tabs controller={controller} showTabs submenuCollapsed={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Manage tabs' }))
    const drawer = screen.getByRole('complementary', { name: 'Tab settings drawer' })

    fireEvent.click(within(drawer).getByRole('button', { name: 'Rename tab: Introduction' }))
    expect(within(drawer).queryByRole('button', { name: 'Add Tab' })).not.toBeInTheDocument()
    expect(
      within(drawer).queryByRole('button', { name: 'Drag to reorder tab: Introduction' }),
    ).not.toBeInTheDocument()

    const input = within(drawer).getByRole('textbox', { name: 'Rename tab: Introduction' })
    fireEvent.change(input, { target: { value: 'Overview' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))
    expect(renameTab).toHaveBeenCalledWith('intro', 'Overview')

    fireEvent.click(within(drawer).getByRole('button', { name: 'Add Tab' }))
    expect(within(drawer).queryByRole('button', { name: 'Add Tab' })).not.toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))
    expect(addTab).toHaveBeenCalledOnce()
  })
})
