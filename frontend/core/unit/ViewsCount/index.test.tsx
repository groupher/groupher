import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ViewsCount from '.'

vi.mock('~/icons/article/Viewed', () => ({ default: () => <span data-testid='view-icon' /> }))
vi.mock('./salon', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
  default: () => ({
    count: 'pretty-num text-sm',
    highLight: 'highlight',
    viewIcon: 'view-icon',
    wrapper: 'wrapper',
  }),
}))

describe('ViewsCount', () => {
  it('reserves the list slot while the Summary is loading', () => {
    render(<ViewsCount />)

    const count = screen.getByLabelText('views')
    expect(count).toHaveClass('view-count-slot-list')
    expect(count).toHaveClass('pretty-num')
    expect(count).toBeEmptyDOMElement()
  })

  it('does not render a placeholder class after the Summary is available', () => {
    render(<ViewsCount count={159} />)

    const count = screen.getByLabelText('views')
    expect(count).not.toHaveClass('view-count-slot-list')
    expect(count).toHaveTextContent('159')
  })
})
