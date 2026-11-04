import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import CommunityBrief from './CommunityBrief'

const state = vi.hoisted(() => ({ homepage: undefined as string | null | undefined }))

vi.mock('~/hooks/usePublicThreads', () => ({ default: () => [] }))
vi.mock('~/hooks/useLayout', () => ({ default: () => ({ brandLayout: 'text' }) }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ title: 'Dev', slug: 'dev', logo: '' }),
}))
vi.mock('~/stores/dsbConfig/hooks', () => ({ default: () => state }))
vi.mock('~/Img', () => ({ default: () => null }))
vi.mock('~/ui/ImgFallback', () => ({ default: () => null }))
vi.mock('~/ui/Tooltip', () => ({
  default: ({ children, content }: { children: ReactNode; content: ReactNode }) => (
    <>
      {children}
      {content}
    </>
  ),
}))
vi.mock('../salon/dashboard_layout/community_brief', () => ({
  default: () => ({}),
  cn: (...values: string[]) => values.filter(Boolean).join(' '),
}))

it.each([undefined, null, '', '   '])(
  'keeps a new community menu usable without homepage %s',
  (value) => {
    state.homepage = value
    render(<CommunityBrief />)

    expect(
      screen.queryByRole('link', { name: 'dsb.community_brief.back_home' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'dsb.community_brief.github' })).toHaveAttribute(
      'href',
      '/dev',
    )
  },
)

it('links to the configured homepage', () => {
  state.homepage = ' https://example.com '
  render(<CommunityBrief />)

  expect(screen.getByRole('link', { name: 'dsb.community_brief.back_home' })).toHaveAttribute(
    'href',
    'https://example.com',
  )
})
