import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import RealModal from './RealModal'

const pageLockMocks = vi.hoisted(() => ({
  lockPage: vi.fn(),
  toggleGlobalBlur: vi.fn(),
  unlockPage: vi.fn(),
}))

vi.mock('~/dom', () => pageLockMocks)
vi.mock('~/hooks/useShortcut', () => ({ default: vi.fn() }))
vi.mock('~/hooks/useTheme', () => ({ default: () => ({ theme: 'light' }) }))
vi.mock('~/hooks/useTopGlow', () => ({ default: () => ({ glowType: 'none' }) }))
vi.mock('~/icons/CloseLight', () => ({ default: () => null }))
vi.mock('~/ui/Portal', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/ui/ViewportTracker', () => ({
  default: ({ onEnter }: { onEnter: () => void }) => (
    <button
      type='button'
      aria-label='enter viewport'
      data-testid='viewport-enter'
      onClick={onEnter}
    />
  ),
}))
vi.mock('./salon', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
  default: () => ({
    mask: '',
    wrapper: '',
    glowLight: '',
    glowLightStyle: () => ({}),
    closeBox: '',
    closeIcon: '',
    children: '',
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RealModal page lock ownership', () => {
  it('does not release a page lock it never acquired', () => {
    const { unmount } = render(
      <RealModal show={false} handleCloseModal={vi.fn()}>
        content
      </RealModal>,
    )

    unmount()

    expect(pageLockMocks.lockPage).not.toHaveBeenCalled()
    expect(pageLockMocks.unlockPage).not.toHaveBeenCalled()
  })

  it('releases its own page lock exactly once when hidden', () => {
    const handleCloseModal = vi.fn()
    const { rerender, unmount } = render(
      <RealModal show handleCloseModal={handleCloseModal}>
        content
      </RealModal>,
    )

    fireEvent.click(screen.getByTestId('viewport-enter'))
    expect(pageLockMocks.lockPage).toHaveBeenCalledTimes(1)

    rerender(
      <RealModal show={false} handleCloseModal={handleCloseModal}>
        content
      </RealModal>,
    )

    expect(pageLockMocks.unlockPage).toHaveBeenCalledTimes(1)

    unmount()
    expect(pageLockMocks.unlockPage).toHaveBeenCalledTimes(1)
  })
})
