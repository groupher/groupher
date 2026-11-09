import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'

import type { TTicket } from '~/spec'

import TicketWorkbench from '../TicketWorkbench'

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  invalidate: vi.fn(),
  invalidatePrefix: vi.fn(),
  queryClient: { fetchQuery: vi.fn() },
  useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => mocks.queryClient,
}))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/hooks/useTrans', () => ({
  default: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(', ')}` : key,
  }),
}))
vi.mock('~/platform', () => ({
  Link: ({ children, route }: { children: ReactNode; route: { path: string } }) => (
    <a href={route.path}>{children}</a>
  ),
}))
vi.mock('~/query', () => ({
  ticketQueries: {
    internalDetail: () => ({ queryKey: ['ticket', 'internal-detail'] }),
    assigneeCandidates: () => ({ queryKey: ['ticket', 'assignee-candidates'] }),
    searchInternal: () => ({ queryKey: ['ticket', 'search'] }),
    tagGroups: () => ({ queryKey: ['ticket', 'tag-groups'] }),
  },
}))
vi.mock('~/query/mutation/optimistic/execute', () => ({ executeCommand: mocks.executeCommand }))
vi.mock('~/query/invalidation', async () => ({
  ...(await vi.importActual<typeof import('~/query/invalidation')>('~/query/invalidation')),
  invalidate: mocks.invalidate,
  invalidatePrefix: mocks.invalidatePrefix,
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Buttons/Button', () => ({
  default: ({
    children,
    disabled,
    loading,
    onClick,
  }: {
    children: ReactNode
    disabled?: boolean
    loading?: boolean
    onClick?: () => void
  }) => (
    <button type='button' disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock('~/ui/Input', () => ({
  default: ({
    behavior,
    onChange,
    placeholder,
    rows,
    type,
    value,
  }: {
    behavior?: string
    onChange?: (event: { target: { value: string } }) => void
    placeholder?: string
    rows?: number
    type?: string
    value?: string
  }) =>
    behavior === 'textarea' ? (
      <textarea placeholder={placeholder} rows={rows} value={value} onChange={onChange} />
    ) : (
      <input placeholder={placeholder} type={type} value={value} onChange={onChange} />
    ),
}))
vi.mock('~/ui/Modal', () => ({
  default: ({ children, show }: { children: ReactNode; show: boolean }) =>
    show ? <div>{children}</div> : null,
}))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
vi.mock('~/unit/DsbThread/Kanban/TicketTimeline', () => ({ default: () => <div /> }))

const draftTicket: TTicket = {
  id: 'ticket-id',
  innerId: null,
  type: 'USER',
  status: 'TODO',
  publicationState: 'DRAFT',
  canPublishPublicUpdates: false,
  priority: 1,
  lifecycleVersion: 2,
  workflowVersion: 3,
  draftVersion: 1,
  publicationPreview: 'review-anchor',
  draftContent: {
    title: 'Saved public title',
    digest: 'Saved independent summary',
    body: 'Ticket body',
  },
  publishedContent: null,
  hasUnpublishedChanges: null,
  rank: 0,
  title: 'Saved public title',
  digest: 'Saved independent summary',
  plainText: 'Ticket body',
  body: 'Ticket body',
  plannedStartAt: null,
  plannedEndAt: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  assignees: [],
  tags: [],
  facets: [],
  sources: [
    {
      id: 'post-id',
      type: 'POST',
      innerId: 71,
      title: 'Blocked Post',
      isPublic: false,
      reviewBlockTypes: ['manual_hold'],
    },
  ],
  workers: [],
  members: [],
  cases: [],
  sharedWorkers: [],
  parent: null,
  activity: null,
  updates: [],
}

const publicTicket: TTicket = {
  ...draftTicket,
  innerId: 17,
  publicationState: 'PUBLISHED',
  canPublishPublicUpdates: true,
  lifecycleVersion: 4,
  draftVersion: null,
  draftContent: null,
  publishedContent: {
    title: 'Saved public title',
    digest: 'Saved independent summary',
    body: 'Ticket body',
  },
  hasUnpublishedChanges: false,
  sources: [],
  updates: [
    {
      id: 'update-original',
      body: 'Original public update',
      visibility: 'PUBLIC',
      authorId: 'admin-id',
      publishedAt: '2026-10-30T12:00:00Z',
      supersedesId: null,
    },
  ],
}

describe('<TicketWorkbench />', () => {
  beforeEach(() => {
    mocks.executeCommand.mockResolvedValue({})
    mocks.queryClient.fetchQuery.mockResolvedValue(draftTicket)
    mocks.invalidate.mockResolvedValue({ failures: [] })
    mocks.invalidatePrefix.mockResolvedValue(undefined)
    mocks.useQuery.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[1] === 'assignee-candidates') return { data: [] }
      if (options.queryKey[1] === 'tag-groups') return { data: [] }
      return { data: { entries: [] } }
    })
  })

  it('keeps Draft Ticket updates internal and shows the linked Post review block', async () => {
    render(<TicketWorkbench ticket={draftTicket} />)

    const updateVisibility = screen.getByLabelText('ticket.workbench.update_visibility')
    expect(updateVisibility).toHaveValue('INTERNAL')
    expect(screen.getByRole('option', { name: 'ticket.workbench.public' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'ticket.workbench.review_blocked_post manual_hold',
    )

    fireEvent.change(screen.getByPlaceholderText('ticket.workbench.update_placeholder'), {
      target: { value: 'Internal review note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ticket.workbench.add_update' }))

    await waitFor(() => expect(mocks.executeCommand).toHaveBeenCalledTimes(1))
    expect(mocks.executeCommand.mock.calls[0][0].variables.visibility).toBe('INTERNAL')
  })

  it('previews the saved title and summary before explicitly republishing', async () => {
    render(<TicketWorkbench ticket={draftTicket} />)

    fireEvent.change(screen.getByPlaceholderText('ticket.workbench.visibility_reason'), {
      target: { value: 'Review completed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ticket.workbench.publish' }))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(
      within(screen.getByRole('alertdialog')).getByText('Saved public title'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('alertdialog')).getByText('Saved independent summary'),
    ).toBeInTheDocument()
    expect(mocks.executeCommand).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'ticket.workbench.confirm_publish' }))

    await waitFor(() => expect(mocks.executeCommand).toHaveBeenCalledTimes(1))
    expect(mocks.executeCommand.mock.calls[0][0].variables).toMatchObject({
      reason: 'Review completed',
      expectedDraftVersion: 1,
      expectedLifecycleVersion: 2,
      expectedWorkflowVersion: 3,
    })
    expect(mocks.invalidatePrefix).toHaveBeenCalledWith(mocks.queryClient, ['ticket'])
    expect(mocks.invalidate).toHaveBeenCalledWith(
      mocks.queryClient,
      expect.arrayContaining([
        { domain: 'article', target: 'lists', scope: { community: 'home', thread: 'POST' } },
        {
          domain: 'article',
          target: 'content',
          path: { community: 'home', thread: 'POST', innerId: '71' },
        },
      ]),
    )
  })

  it('publishes a correction that supersedes the selected public update', async () => {
    render(<TicketWorkbench ticket={publicTicket} />)

    fireEvent.click(screen.getByRole('button', { name: 'ticket.workbench.correct_update' }))
    expect(
      screen.getByPlaceholderText('ticket.workbench.correction_placeholder'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('ticket.workbench.correction_placeholder'), {
      target: { value: 'Corrected public update' },
    })
    expect(screen.getByRole('button', { name: 'ticket.workbench.submit_correction' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'ticket.workbench.submit_correction' }))

    await waitFor(() => expect(mocks.executeCommand).toHaveBeenCalledTimes(1))
    expect(mocks.executeCommand.mock.calls[0][0].variables).toMatchObject({
      body: 'Corrected public update',
      visibility: 'PUBLIC',
      supersedesId: 'update-original',
      expectedLifecycleVersion: 4,
      expectedWorkflowVersion: 3,
    })
  })

  it('disables PUBLIC updates while a published Ticket has an active ReviewBlock', () => {
    render(
      <TicketWorkbench ticket={{ ...publicTicket, canPublishPublicUpdates: false, updates: [] }} />,
    )

    expect(screen.getByRole('option', { name: 'ticket.workbench.public' })).toBeDisabled()
    expect(screen.getByLabelText('ticket.workbench.update_visibility')).toHaveValue('INTERNAL')
  })
  it('saves pending edits before previewing the complete publication and its anchors', async () => {
    const current = {
      ...draftTicket,
      title: 'New title',
      draftVersion: 2,
      plainText: 'Full publication body',
      sources: [
        { id: 'source', type: 'POST', innerId: 71, title: 'Visible source', isPublic: true },
      ],
      updates: [
        { id: 'old', body: 'Superseded text', visibility: 'PUBLIC', supersedesId: null },
        { id: 'new', body: 'Reviewed correction', visibility: 'PUBLIC', supersedesId: 'old' },
      ],
    }
    mocks.queryClient.fetchQuery.mockResolvedValue(current)
    render(<TicketWorkbench ticket={draftTicket} />)
    fireEvent.change(screen.getByDisplayValue('Saved public title'), {
      target: { value: 'New title' },
    })
    fireEvent.change(screen.getByPlaceholderText('ticket.workbench.visibility_reason'), {
      target: { value: 'Reviewed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ticket.workbench.publish' }))
    const preview = within(await screen.findByRole('alertdialog'))
    expect(preview.getByText('New title')).toBeInTheDocument()
    expect(preview.getByText('Full publication body')).toBeInTheDocument()
    expect(preview.getByText(/Visible source/)).toBeInTheDocument()
    expect(preview.getByText('Reviewed correction')).toBeInTheDocument()
    expect(preview.queryByText('Superseded text')).not.toBeInTheDocument()
    expect(mocks.executeCommand.mock.calls[0][0].variables.content.title).toBe('New title')
    fireEvent.click(preview.getByRole('button', { name: 'ticket.workbench.confirm_publish' }))
    await waitFor(() => expect(mocks.executeCommand).toHaveBeenCalledTimes(2))
    expect(mocks.executeCommand.mock.calls[1][0].variables).toMatchObject({
      expectedDraftVersion: 2,
      expectedPreview: 'review-anchor',
    })
  })

  it('offers content republishing while the Ticket stays Published', async () => {
    mocks.executeCommand.mockResolvedValue({ ensureTicketDraft: { draftVersion: 1 } })
    mocks.queryClient.fetchQuery.mockResolvedValue({
      ...publicTicket,
      draftVersion: 1,
      publicationPreview: 'review-anchor',
    })
    render(<TicketWorkbench ticket={publicTicket} />)
    fireEvent.change(screen.getByPlaceholderText('ticket.workbench.visibility_reason'), {
      target: { value: 'Reviewed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ticket.workbench.publish_changes' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(
      mocks.executeCommand.mock.calls.some(([command]) => command.variables.reason === 'Reviewed'),
    ).toBe(false)
  })
  it('links owned Workers to their working detail route', () => {
    const worker = {
      id: 'worker-id',
      title: 'Implement fix',
      status: 'TODO',
    } as TTicket['workers'][number]
    render(<TicketWorkbench ticket={{ ...publicTicket, workers: [worker] }} />)
    expect(screen.getByRole('link', { name: /Implement fix/ })).toHaveAttribute(
      'href',
      'kanban/ticket/worker-id',
    )
  })
})
