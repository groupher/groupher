import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import UserCard from './UserCard'

vi.mock('~/hooks/useTwBelt', () => ({
  default: () => ({
    cn: (...values: string[]) => values.join(' '),
    fg: () => '',
    avatar: () => '',
  }),
}))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ user: { login: 'me' } }),
}))
vi.mock('~/Img', () => ({ default: () => null }))
vi.mock('~/platform', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('~/ui/ImgFallback', () => ({ default: () => null }))
vi.mock('~/unit/AlertWall/ReportAction', () => ({
  default: () => <div data-testid='report-action' />,
}))

it('hides the report action on the current user card', () => {
  render(<UserCard user={{ login: 'me', nickname: 'Me' }} />)

  expect(screen.queryByTestId('report-action')).not.toBeInTheDocument()
})

it('shows the report action on another user card', () => {
  render(<UserCard user={{ login: 'other', nickname: 'Other' }} />)

  expect(screen.getByTestId('report-action')).toBeInTheDocument()
})
