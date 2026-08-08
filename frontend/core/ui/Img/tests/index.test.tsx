import { render, screen, waitFor } from '@testing-library/react'

import Img from '..'

describe('<Img />', () => {
  it('renders NativeImg when noLazy=true', () => {
    render(<Img noLazy src='test.png' alt='test' fallback={<span>fallback</span>} />)

    expect(screen.queryByRole('button', { name: 'test' })).not.toBeInTheDocument()
    expect(screen.getByText('fallback')).toBeInTheDocument()
  })

  it('renders LazyLoadImg by default', async () => {
    render(<Img src='test.png' alt='test' fallback={<span>fallback</span>} visibleByDefault />)

    expect(screen.queryByRole('button', { name: 'test' })).not.toBeInTheDocument()
    expect(screen.getByText('fallback')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'test' })).toBeInTheDocument()
    })

    expect(screen.getByRole('img', { name: 'test' }).parentElement).toHaveClass('abs-full')
  })

  it('renders a button only when clickable', () => {
    render(<Img noLazy src='test.png' alt='test' clickable />)

    expect(screen.getByRole('button', { name: 'test' })).toBeInTheDocument()
  })
})
