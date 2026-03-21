import { render, waitFor } from '@testing-library/react'

import ArticleReadLabel from '..'

let mockIsLogin = false
let mockLoading = false

vi.mock('~/hooks/useAccount', () => ({
  default: () => ({ isLogin: mockIsLogin, loading: mockLoading }),
}))

vi.mock('../salon', () => ({
  default: () => ({ wrapper: 'mock-wrapper' }),
}))

describe('<ArticleReadLabel />', () => {
  beforeEach(() => {
    mockIsLogin = false
    mockLoading = false
  })

  it('returns null while account state is still loading', () => {
    mockLoading = true
    mockIsLogin = true
    const { container } = render(<ArticleReadLabel viewed={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when user is not logged in', () => {
    mockIsLogin = false
    const { container } = render(<ArticleReadLabel viewed={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the label when user is logged in and not viewed', () => {
    mockIsLogin = true
    const { container } = render(<ArticleReadLabel viewed={false} />)
    return waitFor(() => {
      expect(container.firstChild).not.toBeNull()
      expect(container.firstChild).toHaveClass('mock-wrapper')
    })
  })

  it('returns null when user is logged in and viewed is true', () => {
    mockIsLogin = true
    const { container } = render(<ArticleReadLabel viewed />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the label when user is logged in and viewed is undefined', () => {
    mockIsLogin = true
    const { container } = render(<ArticleReadLabel />)
    return waitFor(() => {
      expect(container.firstChild).not.toBeNull()
      expect(container.firstChild).toHaveClass('mock-wrapper')
    })
  })
})
