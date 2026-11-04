import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import CommunityBrief from './CommunityBrief'

const state = vi.hoisted(() => ({ homepage: undefined as string | null | undefined }))

vi.mock('~/hooks/useHover', () => ({ default: () => [null, false] }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'dev' }) }))
vi.mock('~/stores/dsbConfig/hooks', () => ({ default: () => state }))
vi.mock('~/unit/CommunityBrand', () => ({ default: () => null }))
vi.mock('~/ui/Tooltip', () => ({
  default: ({ children, content }: { children: ReactNode; content: ReactNode }) => (
    <>
      {children}
      {content}
    </>
  ),
}))
vi.mock('../salon/classic_layout/community_brief', () => ({
  default: () => ({}),
  cn: (...values: string[]) => values.filter(Boolean).join(' '),
}))

it.each([undefined, null, '', '   '])(
  'renders the public community menu without homepage %s',
  (value) => {
    state.homepage = value
    render(<CommunityBrief />)
    expect(screen.queryByRole('link', { name: '返回官网' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '社区主页' })).toHaveAttribute('href', '/dev')
  },
)

it('uses the configured homepage after trimming', () => {
  state.homepage = ' https://example.com '
  render(<CommunityBrief />)
  expect(screen.getByRole('link', { name: '返回官网' })).toHaveAttribute(
    'href',
    'https://example.com',
  )
})
