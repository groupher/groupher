import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SubMenuContentLayout from './SubMenuContentLayout'

const dashboardStore = vi.hoisted(() => ({
  submenuCollapsed: false,
}))

vi.mock('~/stores/dashboard/hooks', () => ({
  default: () => ({
    submenuCollapsed: dashboardStore.submenuCollapsed,
  }),
}))

vi.mock('~/unit/DashboardThread/salon', () => ({
  cnMerge: (...inputs: Array<string | false | null | undefined>) =>
    inputs.filter(Boolean).join(' '),
  default: () => ({
    content: 'column w-3/5',
  }),
}))

const renderLayout = () => {
  render(
    <SubMenuContentLayout>
      <div data-testid='content-child' />
    </SubMenuContentLayout>,
  )

  return screen.getByTestId('content-child').parentElement as HTMLElement
}

describe('<SubMenuContentLayout />', () => {
  afterEach(() => {
    dashboardStore.submenuCollapsed = false
    cleanup()
  })

  it('keeps the submenu content inset while expanded', () => {
    dashboardStore.submenuCollapsed = false

    const layout = renderLayout()

    expect(layout.className).toContain('pl-10')
    expect(layout.className).not.toContain('pl-0')
  })

  it('removes the submenu content inset while collapsed', () => {
    dashboardStore.submenuCollapsed = true

    const layout = renderLayout()

    expect(layout.className).toContain('pl-0')
    expect(layout.className).not.toContain('pl-10')
  })
})
