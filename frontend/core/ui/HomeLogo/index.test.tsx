import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import HomeLogo from '.'

describe('HomeLogo', () => {
  it('renders without store providers', () => {
    render(<HomeLogo size={4} left={2} />)

    expect(screen.getByLabelText('img')).toHaveClass('size-4', 'ml-2')
  })
})
