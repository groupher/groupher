import { render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AddTabPortal, { ADD_TAB_BREADCRUMB_SLOT_ID } from './AddTabPortal'

vi.mock('./AddTabButton', () => ({
  default: () => <button type='button'>Add Tab</button>,
}))

afterEach(() => document.getElementById(ADD_TAB_BREADCRUMB_SLOT_ID)?.remove())

describe('docs editor AddTab portal', () => {
  it('renders in the breadcrumb slot only while there are no tabs', () => {
    const slot = document.createElement('span')
    slot.id = ADD_TAB_BREADCRUMB_SLOT_ID
    document.body.append(slot)

    const { rerender } = render(<AddTabPortal show />)
    expect(within(slot).getByRole('button', { name: 'Add Tab' })).toBeInTheDocument()

    rerender(<AddTabPortal show={false} />)
    expect(within(slot).queryByRole('button', { name: 'Add Tab' })).not.toBeInTheDocument()
  })
})
