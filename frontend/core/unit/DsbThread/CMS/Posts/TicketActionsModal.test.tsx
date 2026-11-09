import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import type { TArticle } from '~/spec'

import TicketActionsModal from './TicketActionsModal'

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  invalidatePrefix: vi.fn(),
  postLinksInternal: vi.fn((community: string, postId: string) => ({
    queryKey: ['ticket', 'post-links-internal', community, postId],
  })),
  queryClient: {},
  useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => mocks.queryClient,
}))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/query', () => ({
  ticketQueryKeys: { all: ['ticket'] },
  ticketQueries: {
    postLinksInternal: mocks.postLinksInternal,
    searchInternal: () => ({ queryKey: ['ticket', 'search'] }),
  },
}))
vi.mock('~/query/invalidation', async () => ({
  ...(await vi.importActual<typeof import('~/query/invalidation')>('~/query/invalidation')),
  invalidate: mocks.invalidate,
  invalidatePrefix: mocks.invalidatePrefix,
}))
vi.mock('~/query/mutation/optimistic/execute', () => ({ executeCommand: vi.fn() }))
vi.mock('~/schemas/pages/ticket', () => ({
  createTicketFromPost: {},
  linkPostToTicket: {},
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Buttons/Button', () => ({
  default: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button type='button' disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock('~/ui/Input', () => ({
  default: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange?: (event: { target: { value: string } }) => void
    placeholder?: string
    value?: string
  }) => <input placeholder={placeholder} value={value} onChange={onChange} />,
}))
vi.mock('~/ui/Modal', () => ({
  default: ({ children, show }: { children: ReactNode; show: boolean }) =>
    show ? <div>{children}</div> : null,
}))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))

describe('<TicketActionsModal />', () => {
  beforeEach(() => {
    mocks.invalidate.mockResolvedValue({ failures: [] })
    mocks.invalidatePrefix.mockResolvedValue(undefined)
    mocks.postLinksInternal.mockClear()
    mocks.useQuery.mockImplementation((options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[1] === 'post-links-internal') {
        return {
          data: [
            {
              id: 'held-ticket-id',
              innerId: 23,
              title: 'Held linked ticket',
              status: 'WIP',
              publicationState: 'DRAFT',
            },
          ],
        }
      }
      return { data: { entries: [] }, isPending: false }
    })
  })

  it('shows held linked Tickets in the duplicate warning', () => {
    const post = {
      id: 'post-uuid',
      innerId: '71',
      title: 'Post title',
      digest: 'Post summary',
      body: { markdown: 'Post body' },
    } as unknown as TArticle

    render(<TicketActionsModal post={post} show onClose={vi.fn()} />)

    expect(mocks.postLinksInternal).toHaveBeenCalledWith('home', 'post-uuid')
    expect(screen.getByText('ticket.management.already_linked')).toBeInTheDocument()
    expect(screen.getByText(/Held linked ticket/)).toHaveTextContent('ticket.management.draft')
  })
})
