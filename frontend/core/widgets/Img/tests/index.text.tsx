import { render, screen, waitFor } from '@testing-library/react'

import Img from '..'

describe('<Img />', () => {
  it('renders NativeImg when noLazy=true', () => {
    render(
      <Img
        noLazy
        src='test.png'
        alt='test'
        fallback={<span>fallback</span>}
      />,
    )

    const btn = screen.getByRole('button', { name: 'test' })
    expect(btn).toBeDisabled()
    expect(screen.getByText('fallback')).toBeInTheDocument()
  })

  it('renders LazyLoadImg by default', async () => {
    const { container } = render(
      <Img
        src='test.png'
        alt='test'
        fallback={<span>fallback</span>}
        visibleByDefault
      />,
    )

    const btn = screen.getByRole('button', { name: 'test' })
    expect(btn).not.toBeDisabled()
    expect(screen.getByText('fallback')).toBeInTheDocument()

    await waitFor(() => {
      expect(container.querySelector('img')).toBeTruthy()
    })
  })
})
