import { GraphQLError } from 'graphql'

const userId = '11111111-1111-4111-8111-111111111111'
const workerId = '22222222-2222-4222-8222-222222222222'
const body = JSON.stringify([{ type: 'p', children: [{ text: 'Complete Ticket body' }] }])
const content = { title: 'E2E published ticket', digest: 'Independent summary', body }
const ticket = {
  id: userId,
  innerId: 71,
  type: 'USER',
  status: 'TODO',
  publicationState: 'PUBLISHED',
  canPublishPublicUpdates: true,
  priority: 1,
  lifecycleVersion: 2,
  workflowVersion: 3,
  draftVersion: null,
  publicationPreview: 'e2e-preview-anchor',
  draftContent: null,
  publishedContent: content,
  hasUnpublishedChanges: false,
  rank: 0,
  ...content,
  plainText: 'Complete Ticket body',
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
      id: 'source-one',
      type: 'POST',
      innerId: 15,
      title: 'Visible source Post',
      isPublic: true,
      reviewBlockTypes: [],
    },
  ],
  workers: [
    {
      id: workerId,
      type: 'WORKER',
      status: 'TODO',
      priority: 1,
      workflowVersion: 1,
      rank: 0,
      innerId: null,
      title: 'Implement E2E fix',
      digest: '',
      plannedStartAt: null,
      plannedEndAt: null,
    },
  ],
  members: [],
  cases: [],
  sharedWorkers: [],
  parent: null,
  activity: {
    entries: [],
    pageInfo: {
      __typename: 'OffsetPageInfo',
      page: 1,
      size: 20,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
  updates: [
    {
      id: 'public-update',
      body: 'Public progress to review',
      visibility: 'PUBLIC',
      authorId: '1',
      publishedAt: '2026-11-01T00:00:00Z',
      supersedesId: null,
    },
  ],
}

/** Deterministic Ticket queries used by the browser publication regression. */
export const ticketQueries = {
  ticket: (_parent, { innerId }) => ({ ...ticket, innerId }),
  ticketInternal: (_parent, { id }) =>
    id === workerId
      ? {
          ...ticket,
          id: workerId,
          type: 'WORKER',
          innerId: null,
          title: 'Implement E2E fix',
          publicationState: 'DRAFT',
          draftVersion: 1,
          workers: [],
          sources: [],
          updates: [],
        }
      : ticket,
}

/** Implements enough versioned Ticket writes to exercise the real browser workflow. */
export const ticketMutations = {
  ensureTicketDraft: () => {
    ticket.draftVersion ??= 1
    ticket.draftContent ??= { ...ticket.publishedContent }
    return ticket
  },
  saveTicketDraft: (_parent, args) => {
    if (args.expectedDraftVersion !== ticket.draftVersion)
      throw new GraphQLError('Draft version conflict')
    Object.assign(ticket, args.content)
    ticket.draftVersion += 1
    ticket.draftContent = { title: ticket.title, digest: ticket.digest, body: ticket.body }
    ticket.hasUnpublishedChanges = true
    return ticket
  },
  updateTicket: () => {
    ticket.workflowVersion += 1
    return ticket
  },
  publishTicket: (_parent, args) => {
    if (
      args.expectedPreview !== ticket.publicationPreview ||
      args.expectedDraftVersion !== ticket.draftVersion ||
      args.expectedLifecycleVersion !== ticket.lifecycleVersion ||
      args.expectedWorkflowVersion !== ticket.workflowVersion
    )
      throw new GraphQLError('Stale publication preview')
    ticket.publishedContent = ticket.draftContent
    ticket.draftContent = null
    ticket.draftVersion = null
    ticket.hasUnpublishedChanges = false
    ticket.lifecycleVersion += 1
    ticket.workflowVersion += 1
    return ticket
  },
  moveTicketToDraft: () => {
    throw new GraphQLError('This browser regression must not withdraw the Published Ticket')
  },
}
