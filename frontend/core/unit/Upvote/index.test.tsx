import { render, screen } from '@testing-library/react'

import { UPVOTE_LAYOUT } from '~/const/layout'

import Upvote from './index'

vi.mock('./salon', () => ({ default: () => ({ wrapper: 'wrapper' }) }))
vi.mock('./GeneralLayout', () => ({ default: () => <div data-testid='upvote-layout' /> }))
vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: () => 'Action failed. Please try again.' }),
}))

it('keeps the live region mounted and fills it when the optimistic action fails', () => {
  const { rerender } = render(<Upvote type={UPVOTE_LAYOUT.GENERAL} />)
  const status = screen.getByRole('status')

  expect(status).toHaveClass('sr-only')
  expect(status).toBeEmptyDOMElement()

  rerender(<Upvote error={new Error('request failed')} type={UPVOTE_LAYOUT.GENERAL} />)

  expect(screen.getByRole('status')).toBe(status)
  expect(status).toHaveTextContent('Action failed. Please try again.')
})
