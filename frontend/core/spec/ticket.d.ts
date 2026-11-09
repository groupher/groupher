import type { TGraphQLPagiPageInfo } from './pagination'

export type TTicketStatus = 'TODO' | 'WIP' | 'DONE' | 'OPEN' | 'RESOLVED'
export type TTicketPublicationState = 'DRAFT' | 'PUBLISHED'

export type TTicketSourceRef = {
  id: string
  type: 'POST'
  innerId: number | null
  title: string | null
  isPublic?: boolean
  reviewBlockTypes?: readonly string[]
}

export type TTicketRelationRef = {
  id: string
  innerId: number | null
  type: 'USER' | 'WORKER' | 'CASE'
  status: TTicketStatus
  priority: number
  workflowVersion: number
  rank: number
  title: string
  digest: string | null
  plannedStartAt: string | null
  plannedEndAt: string | null
}

export type TTicketActivity = {
  id: string
  action: string
  payload: unknown
  actorRef: string | null
  occurredAt: string
}

export type TTicketContent = {
  title: string
  digest: string
  body: string
}

export type TTicketActivityConnection = {
  entries: readonly TTicketActivity[]
  pageInfo: TGraphQLPagiPageInfo
}

export type TTicketUpdate = {
  id: string
  body: string
  visibility: 'PUBLIC' | 'INTERNAL'
  authorId: string | null
  publishedAt: string | null
  supersedesId: string | null
}

export type TTicketAssignee = {
  id: string
  login: string
  nickname: string | null
}

export type TTicketTagRef = {
  id: number
  title: string
  slug: string
  color: string | null
}

export type TTicketFacet = {
  key: string
  value: string
}

export type TTicketFilter = {
  type?: 'USER' | 'WORKER' | 'CASE'
  status?: TTicketStatus
  assigneeId?: number
  priority?: number
  tagIds?: number[]
  versions?: string[]
  operatingSystems?: string[]
  modules?: string[]
  createdAfter?: string
  createdBefore?: string
  updatedAfter?: string
  updatedBefore?: string
  plannedAfter?: string
  plannedBefore?: string
}

export type TTicket = {
  id: string
  innerId: number | null
  type: 'USER' | 'WORKER' | 'CASE'
  status: TTicketStatus
  publicationState: TTicketPublicationState
  canPublishPublicUpdates: boolean
  priority: number
  lifecycleVersion: number | null
  workflowVersion: number | null
  draftVersion: number | null
  publicationPreview: string | null
  draftContent: TTicketContent | null
  publishedContent: TTicketContent | null
  hasUnpublishedChanges: boolean | null
  rank: number
  title: string
  digest: string
  plainText: string | null
  body: string
  plannedStartAt: string | null
  plannedEndAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  assignees: readonly TTicketAssignee[]
  tags: readonly TTicketTagRef[]
  facets: readonly TTicketFacet[]
  sources: readonly TTicketSourceRef[]
  workers: readonly TTicketRelationRef[]
  members: readonly TTicketRelationRef[]
  cases: readonly TTicketRelationRef[]
  sharedWorkers: readonly TTicketRelationRef[]
  parent: TTicketRelationRef | null
  activity: TTicketActivityConnection | null
  updates: readonly TTicketUpdate[]
}

export type TTicketStats = {
  upvotesCount: number
  commentsCount: number
  views: number
}

export type TTicketViewModel = {
  content: TTicket
  stats: TTicketStats
}

export type TPagedTickets = {
  entries: readonly TTicket[]
  pageInfo: TGraphQLPagiPageInfo
}

export type TPostTicketProgress = {
  postInnerId: number
  status: Extract<TTicketStatus, 'TODO' | 'WIP' | 'DONE'>
  completed: number
  total: number
  tickets: readonly {
    id: string
    innerId: number
    title: string
    status: Extract<TTicketStatus, 'TODO' | 'WIP' | 'DONE'>
  }[]
}
