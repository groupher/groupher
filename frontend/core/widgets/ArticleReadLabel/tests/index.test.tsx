import { render } from '@testing-library/react'

import ArticleReadLabel from '..'

let mockIsLogin = false

vi.mock('~/hooks/useAccount', () => ({
  default: () => ({ isLogin: mockIsLogin }),
}))

vi.mock('../salon', () => ({
  default: () => ({ wrapper: 'mock-wrapper' }),
}))

describe('<ArticleReadLabel />', () => {
  it('returns null when user is not logged in', () => {
    mockIsLogin = false
    const { container } = render(<ArticleReadLabel viewed={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the label when user is logged in and not viewed', () => {
    mockIsLogin = true
    const { container } = render(<ArticleReadLabel viewed={false} />)
    expect(container.firstChild).not.toBeNull()
    expect(container.firstChild).toHaveClass('mock-wrapper')
  })

  it('returns null when user is logged in and viewed is true', () => {
    mockIsLogin = true
    const { container } = render(<ArticleReadLabel viewed />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the label when user is logged in and viewed is undefined', () => {
    mockIsLogin = true
    const { container } = render(<ArticleReadLabel />)
    expect(container.firstChild).not.toBeNull()
    expect(container.firstChild).toHaveClass('mock-wrapper')
  })
})
