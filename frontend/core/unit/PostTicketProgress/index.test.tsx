import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import PostTicketProgress from './index'

vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/CommunityPreviewLink', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('<PostTicketProgress />', () => {
  it('shows the Ticket number and title in the progress link', () => {
    render(
      <PostTicketProgress
        progress={{
          postInnerId: 71,
          status: 'WIP',
          completed: 0,
          total: 1,
          tickets: [{ id: 'ticket-id', innerId: 17, title: 'Improve search', status: 'WIP' }],
        }}
      />,
    )

    expect(screen.getByRole('link', { name: '#17 · Improve search' })).toHaveAttribute(
      'href',
      '/home/ticket/17',
    )
  })
})
