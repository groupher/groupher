import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import EmotionSelector from './index'

vi.mock('./salon', () => ({ default: () => ({ selectEmotion: 'selector' }) }))
vi.mock('./SelectedEmotions', () => ({ default: () => null }))
vi.mock('./Panel', () => ({ default: () => null }))
vi.mock('~/ui/Buttons/IconButton', () => ({ default: () => null }))
vi.mock('~/ui/Tooltip', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: () => 'Action failed. Please try again.' }),
}))

it('keeps the live region mounted and fills it when the optimistic action fails', () => {
  const { rerender } = render(<EmotionSelector emotions={[]} />)
  const status = screen.getByRole('status')

  expect(status).toHaveClass('sr-only')
  expect(status).toBeEmptyDOMElement()

  rerender(<EmotionSelector error={new Error('request failed')} emotions={[]} />)

  expect(screen.getByRole('status')).toBe(status)
  expect(status).toHaveTextContent('Action failed. Please try again.')
})
