import { graphql } from '~/graphql/authoring'

export const ticketFields = graphql(`
  fragment TicketFields on Ticket {
    id
    innerId
    type
    status
    publicationState
    canPublishPublicUpdates
    priority
    lifecycleVersion
    workflowVersion
    draftVersion
    publicationPreview
    draftContent {
      title
      digest
      body
    }
    publishedContent {
      title
      digest
      body
    }
    hasUnpublishedChanges
    rank
    title
    digest
    body
    plainText
    plannedStartAt
    plannedEndAt
    startedAt
    completedAt
    createdAt
    updatedAt
    assignees {
      id
      login
      nickname
    }
    tags {
      id
      title
      slug
      color
    }
    facets {
      key
      value
    }
    sources {
      id
      type
      innerId
      title
      isPublic
      reviewBlockTypes
    }
    workers {
      id
      type
      status
      priority
      workflowVersion
      rank
      innerId
      title
      digest
      plannedStartAt
      plannedEndAt
    }
    members {
      id
      type
      status
      priority
      workflowVersion
      rank
      innerId
      title
      digest
      plannedStartAt
      plannedEndAt
    }
    cases {
      id
      type
      status
      priority
      workflowVersion
      rank
      innerId
      title
      digest
      plannedStartAt
      plannedEndAt
    }
    sharedWorkers {
      id
      type
      status
      priority
      workflowVersion
      rank
      innerId
      title
      digest
      plannedStartAt
      plannedEndAt
    }
    parent {
      id
      type
      status
      priority
      workflowVersion
      rank
      innerId
      title
      digest
      plannedStartAt
      plannedEndAt
    }
    activity {
      entries {
        id
        action
        payload
        occurredAt
        actorRef
      }
      pageInfo {
        __typename
        hasNextPage
        hasPreviousPage
        ... on OffsetPageInfo {
          page
          size
          totalCount
          totalPages
        }
        ... on CursorPageInfo {
          startCursor
          endCursor
        }
      }
    }
    updates {
      id
      body
      visibility
      authorId
      publishedAt
      supersedesId
    }
  }
`)

export const ticketPageFields = graphql(`
  fragment TicketPageFields on TicketPage {
    entries {
      ...TicketFields
    }
    pageInfo {
      __typename
      hasNextPage
      hasPreviousPage
      ... on OffsetPageInfo {
        page
        size
        totalCount
        totalPages
      }
      ... on CursorPageInfo {
        startCursor
        endCursor
      }
    }
  }
`)

export const ticketKanban = graphql(`
  query TicketKanban($community: String!, $pagi: PagiInput) {
    ticketKanban(community: $community, pagi: $pagi) {
      todo {
        ...TicketPageFields
      }
      wip {
        ...TicketPageFields
      }
      done {
        ...TicketPageFields
      }
    }
  }
`)

export const ticketKanbanInternal = graphql(`
  query TicketKanbanInternal($community: String!, $filter: TicketFilter, $pagi: PagiInput) {
    ticketKanbanInternal(community: $community, filter: $filter, pagi: $pagi) {
      todo {
        ...TicketPageFields
      }
      wip {
        ...TicketPageFields
      }
      done {
        ...TicketPageFields
      }
    }
  }
`)

export const ticketPage = graphql(`
  query TicketPage($community: String!, $filter: TicketFilter, $pagi: PagiInput) {
    ticketPage(community: $community, filter: $filter, pagi: $pagi) {
      ...TicketPageFields
    }
  }
`)

export const ticketPageInternal = graphql(`
  query TicketPageInternal($community: String!, $filter: TicketFilter, $pagi: PagiInput) {
    ticketPageInternal(community: $community, filter: $filter, pagi: $pagi) {
      ...TicketPageFields
    }
  }
`)

export const ticket = graphql(`
  query Ticket($community: String!, $innerId: Int!) {
    ticket(community: $community, innerId: $innerId) {
      ...TicketFields
    }
  }
`)

export const ticketInternal = graphql(`
  query TicketInternal($community: String!, $id: ID!) {
    ticketInternal(community: $community, id: $id) {
      ...TicketFields
    }
  }
`)

export const postTicketLinksInternal = graphql(`
  query PostTicketLinksInternal($community: String!, $postId: ID!) {
    postTicketLinksInternal(community: $community, postId: $postId) {
      ...TicketFields
    }
  }
`)

export const ticketSearch = graphql(`
  query TicketSearch(
    $community: String!
    $query: String!
    $type: TicketTypeEnum
    $pagi: PagiInput
  ) {
    ticketSearch(community: $community, query: $query, type: $type, pagi: $pagi) {
      ...TicketPageFields
    }
  }
`)

export const postTicketProgress = graphql(`
  query PostTicketProgress($community: String!, $postInnerIds: [Int!]!) {
    postTicketProgress(community: $community, postInnerIds: $postInnerIds) {
      postInnerId
      status
      completed
      total
      tickets {
        id
        innerId
        title
        status
      }
    }
  }
`)

export const ticketAssigneeCandidates = graphql(`
  query TicketAssigneeCandidates($community: String!, $pagi: PagiInput) {
    pagedCommunityModerators(community: $community, pagi: $pagi) {
      entries {
        userId
        user {
          login
          nickname
        }
      }
    }
  }
`)

export const ticketTagGroups = graphql(`
  query TicketTagGroups($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      tags {
        id
        title
        slug
        color
      }
    }
  }
`)

export const createTicketFromPost = graphql(`
  mutation CreateTicketFromPost(
    $commandId: ID!
    $community: String!
    $postId: ID!
    $title: String
    $digest: String
  ) {
    createTicketFromPost(
      commandId: $commandId
      community: $community
      postId: $postId
      title: $title
      digest: $digest
    ) {
      ...TicketFields
    }
  }
`)

export const linkTicketSource = graphql(`
  mutation LinkTicketSource(
    $commandId: ID!
    $community: String!
    $ticketId: ID!
    $type: TicketSourceTypeEnum!
    $sourceId: ID!
    $expectedWorkflowVersion: Int!
  ) {
    linkTicketSource(
      commandId: $commandId
      community: $community
      ticketId: $ticketId
      type: $type
      sourceId: $sourceId
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const unlinkTicketSource = graphql(`
  mutation UnlinkTicketSource(
    $commandId: ID!
    $community: String!
    $ticketId: ID!
    $sourceId: ID!
    $expectedWorkflowVersion: Int!
  ) {
    unlinkTicketSource(
      commandId: $commandId
      community: $community
      ticketId: $ticketId
      sourceId: $sourceId
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const createWorkerTicket = graphql(`
  mutation CreateWorkerTicket(
    $commandId: ID!
    $community: String!
    $parentId: ID!
    $expectedWorkflowVersion: Int!
    $title: String
    $digest: String
  ) {
    createWorkerTicket(
      commandId: $commandId
      community: $community
      parentId: $parentId
      expectedWorkflowVersion: $expectedWorkflowVersion
      title: $title
      digest: $digest
    ) {
      ...TicketFields
    }
  }
`)

export const createTicketCase = graphql(`
  mutation CreateTicketCase(
    $commandId: ID!
    $community: String!
    $title: String!
    $digest: String
    $body: String
    $memberTicketId: ID
  ) {
    createTicketCase(
      commandId: $commandId
      community: $community
      title: $title
      digest: $digest
      body: $body
      memberTicketId: $memberTicketId
    ) {
      ...TicketFields
    }
  }
`)

export const transitionTicket = graphql(`
  mutation TransitionTicket(
    $commandId: ID!
    $community: String!
    $id: ID!
    $status: TicketStatusEnum!
    $expectedWorkflowVersion: Int!
  ) {
    transitionTicket(
      commandId: $commandId
      community: $community
      id: $id
      status: $status
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const updateTicket = graphql(`
  mutation UpdateTicket(
    $commandId: ID!
    $community: String!
    $id: ID!
    $priority: Int
    $plannedStartAt: DateTime
    $plannedEndAt: DateTime
    $expectedWorkflowVersion: Int!
  ) {
    updateTicket(
      commandId: $commandId
      community: $community
      id: $id
      priority: $priority
      plannedStartAt: $plannedStartAt
      plannedEndAt: $plannedEndAt
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const addTicketUpdate = graphql(`
  mutation AddTicketUpdate(
    $commandId: ID!
    $community: String!
    $id: ID!
    $body: String!
    $visibility: TicketUpdateVisibilityEnum!
    $supersedesId: ID
    $expectedLifecycleVersion: Int
    $expectedWorkflowVersion: Int!
  ) {
    addTicketUpdate(
      commandId: $commandId
      community: $community
      id: $id
      body: $body
      visibility: $visibility
      supersedesId: $supersedesId
      expectedLifecycleVersion: $expectedLifecycleVersion
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const ensureTicketDraft = graphql(`
  mutation EnsureTicketDraft(
    $commandId: ID!
    $community: String!
    $id: ID!
    $expectedLifecycleVersion: Int!
  ) {
    ensureTicketDraft(
      commandId: $commandId
      community: $community
      id: $id
      expectedLifecycleVersion: $expectedLifecycleVersion
    ) {
      ...TicketFields
    }
  }
`)

export const saveTicketDraft = graphql(`
  mutation SaveTicketDraft(
    $commandId: ID!
    $community: String!
    $id: ID!
    $content: TicketContentInput!
    $expectedDraftVersion: Int!
    $expectedLifecycleVersion: Int!
  ) {
    saveTicketDraft(
      commandId: $commandId
      community: $community
      id: $id
      content: $content
      expectedDraftVersion: $expectedDraftVersion
      expectedLifecycleVersion: $expectedLifecycleVersion
    ) {
      ...TicketFields
    }
  }
`)

export const publishTicket = graphql(`
  mutation PublishTicket(
    $commandId: ID!
    $community: String!
    $id: ID!
    $reason: String!
    $expectedPreview: String!
    $expectedDraftVersion: Int!
    $expectedLifecycleVersion: Int!
    $expectedWorkflowVersion: Int!
  ) {
    publishTicket(
      commandId: $commandId
      community: $community
      id: $id
      reason: $reason
      expectedPreview: $expectedPreview
      expectedDraftVersion: $expectedDraftVersion
      expectedLifecycleVersion: $expectedLifecycleVersion
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const moveTicketToDraft = graphql(`
  mutation MoveTicketToDraft(
    $commandId: ID!
    $community: String!
    $id: ID!
    $reason: String!
    $expectedLifecycleVersion: Int!
  ) {
    moveTicketToDraft(
      commandId: $commandId
      community: $community
      id: $id
      reason: $reason
      expectedLifecycleVersion: $expectedLifecycleVersion
    ) {
      ...TicketFields
    }
  }
`)

export const addTicketCaseMember = graphql(`
  mutation AddTicketCaseMember(
    $commandId: ID!
    $community: String!
    $caseId: ID!
    $ticketId: ID!
    $expectedWorkflowVersion: Int!
  ) {
    addTicketCaseMember(
      commandId: $commandId
      community: $community
      caseId: $caseId
      ticketId: $ticketId
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const removeTicketCaseMember = graphql(`
  mutation RemoveTicketCaseMember(
    $commandId: ID!
    $community: String!
    $caseId: ID!
    $ticketId: ID!
    $expectedWorkflowVersion: Int!
  ) {
    removeTicketCaseMember(
      commandId: $commandId
      community: $community
      caseId: $caseId
      ticketId: $ticketId
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const addTicketCaseWorker = graphql(`
  mutation AddTicketCaseWorker(
    $commandId: ID!
    $community: String!
    $caseId: ID!
    $workerId: ID!
    $expectedWorkflowVersion: Int!
  ) {
    addTicketCaseWorker(
      commandId: $commandId
      community: $community
      caseId: $caseId
      workerId: $workerId
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const setTicketAssignees = graphql(`
  mutation SetTicketAssignees(
    $commandId: ID!
    $community: String!
    $ticketId: ID!
    $assigneeIds: [Int!]!
    $expectedWorkflowVersion: Int!
  ) {
    setTicketAssignees(
      commandId: $commandId
      community: $community
      ticketId: $ticketId
      assigneeIds: $assigneeIds
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const setTicketTags = graphql(`
  mutation SetTicketTags(
    $commandId: ID!
    $community: String!
    $ticketId: ID!
    $tagIds: [Int!]!
    $expectedWorkflowVersion: Int!
  ) {
    setTicketTags(
      commandId: $commandId
      community: $community
      ticketId: $ticketId
      tagIds: $tagIds
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const setTicketFacets = graphql(`
  mutation SetTicketFacets(
    $commandId: ID!
    $community: String!
    $ticketId: ID!
    $facets: [TicketFacetInput!]!
    $expectedWorkflowVersion: Int!
  ) {
    setTicketFacets(
      commandId: $commandId
      community: $community
      ticketId: $ticketId
      facets: $facets
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)
