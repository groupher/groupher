import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ImportContent from './ImportContent'

const mocks = vi.hoisted(() => ({
  activeDocId: 'doc-a' as string | null,
  openDocImport: vi.fn(),
  prepareDocImport: vi.fn(),
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/icons/dsb/CopyPlus', () => ({
  default: () => <svg aria-hidden='true' />,
}))

vi.mock('../Editor/Import/events', () => ({
  openDocImport: mocks.openDocImport,
  prepareDocImport: mocks.prepareDocImport,
}))

vi.mock('../Editor/store/hooks', () => ({
  default: () => ({ publishView: { activeDocId: mocks.activeDocId } }),
}))

vi.mock('./salon/import_content', () => ({
  default: () => ({ button: 'button', icon: () => 'icon' }),
}))

describe('ImportContent', () => {
  it('captures the editor position before opening the shared drawer', () => {
    mocks.activeDocId = 'doc-a'
    mocks.openDocImport.mockReset()
    mocks.prepareDocImport.mockReset()

    render(<ImportContent />)
    const trigger = screen.getByRole('button', { name: 'dsb.doc.action.import_content' })

    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(mocks.prepareDocImport).toHaveBeenCalledWith('doc-a')
    expect(mocks.openDocImport).toHaveBeenCalledWith('doc-a')
  })

  it('blocks both actions when no document is active', () => {
    mocks.activeDocId = null
    mocks.openDocImport.mockReset()
    mocks.prepareDocImport.mockReset()

    render(<ImportContent />)
    const trigger = screen.getByRole('button', { name: 'dsb.doc.action.import_content' })

    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(mocks.prepareDocImport).not.toHaveBeenCalled()
    expect(mocks.openDocImport).not.toHaveBeenCalled()
  })
})
