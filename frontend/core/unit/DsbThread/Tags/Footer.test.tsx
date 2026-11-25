import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import Footer from './Footer'

const mocks = vi.hoisted(() => ({ saveTagSorting: vi.fn(), toast: vi.fn() }))

vi.mock('../logic/useTags', () => ({
  default: () => ({
    hasSortingChanges: true,
    resetTagSorting: vi.fn(),
    saveTagSorting: mocks.saveTagSorting,
    saving: false,
  }),
}))
vi.mock('../SavingBar', () => ({
  default: ({ onConfirm }: { onConfirm?: () => void }) => (
    <button type='button' onClick={onConfirm}>
      Save order
    </button>
  ),
}))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))

describe('Tags Footer', () => {
  beforeEach(() => {
    mocks.saveTagSorting.mockReset()
    mocks.toast.mockReset()
  })

  it('reports sort-save failures without leaving an unhandled rejection', async () => {
    mocks.saveTagSorting.mockRejectedValue(new Error('network failed'))
    render(<Footer />)

    fireEvent.click(screen.getByRole('button', { name: 'Save order' }))

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('Error: network failed', 'error'))
    expect(mocks.saveTagSorting).toHaveBeenCalledOnce()
  })
})
