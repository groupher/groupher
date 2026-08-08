import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import SavingBar from '.'

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({
    t: (key: string) =>
      ({
        'dsb.saving_bar.cancel': 'Cancel',
        'dsb.saving_bar.prefix': 'Save changes',
        'dsb.saving_bar.save': 'Save',
      })[key] || key,
  }),
}))

vi.mock('~/stores/dashboard/hooks', () => ({ default: () => ({ saving: false }) }))
vi.mock('../logic/useHelper', () => ({
  default: () => ({ onSave: vi.fn(), rollbackEdit: vi.fn() }),
}))
vi.mock('~/icons/Back', () => ({ default: () => <span data-testid='revert-icon' /> }))
vi.mock('~/icons/Save', () => ({ default: () => <span data-testid='save-icon' /> }))
vi.mock('~/ui/Buttons/Button', () => ({
  default: ({
    ariaLabel,
    children,
    disabled,
    onClick,
  }: {
    ariaLabel?: string
    children: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button type='button' aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock('./salon', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
  default: () => new Proxy<Record<string, string>>({}, { get: (_, key) => String(key) }),
}))

describe('SavingBar views', () => {
  it('renders a bottom message inline without appending punctuation', () => {
    render(<SavingBar isTouched view='bottom' density='compact' prefix='Manage tabs' />)

    expect(screen.getByText('Manage tabs')).toBeInTheDocument()
    expect(screen.queryByText('?')).not.toBeInTheDocument()
    expect(screen.getByTestId('revert-icon')).toBeInTheDocument()
  })

  it('uses text-only cancel by default for inline editors', () => {
    render(
      <SavingBar isTouched view='inline' density='compact'>
        <input aria-label='Tab title' />
      </SavingBar>,
    )

    expect(screen.getByRole('textbox', { name: 'Tab title' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByTestId('revert-icon')).not.toBeInTheDocument()
  })

  it('allows bottom bars to opt into text-only cancel', () => {
    render(
      <SavingBar
        isTouched
        view='bottom'
        density='compact'
        prefix='Save new order'
        cancelIcon={null}
      />,
    )

    expect(screen.getByText('Save new order')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByTestId('revert-icon')).not.toBeInTheDocument()
  })
})
