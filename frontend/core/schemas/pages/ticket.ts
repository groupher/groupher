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
    workingCopyRevision
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
  fragment PagedTicketsFields on TicketPage {
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
  "Public User Ticket Kanban columns"
  query TicketKanban($community: String!, $pagi: PagiInput) {
    ticketKanban(community: $community, pagi: $pagi) {
      todo {
        ...PagedTicketsFields
      }
      wip {
        ...PagedTicketsFields
      }
      done {
        ...PagedTicketsFields
      }
    }
  }
`)

export const ticketKanbanInternal = graphql(`
  "Internal User Ticket Kanban columns"
  query TicketKanbanInternal($community: String!, $filter: TicketFilter, $pagi: PagiInput) {
    ticketKanbanInternal(community: $community, filter: $filter, pagi: $pagi) {
      todo {
        ...PagedTicketsFields
      }
      wip {
        ...PagedTicketsFields
      }
      done {
        ...PagedTicketsFields
      }
    }
  }
`)

export const ticketPage = graphql(`
  "One public User Ticket page"
  query PagedTickets($community: String!, $filter: TicketFilter, $pagi: PagiInput) {
    ticketPage(community: $community, filter: $filter, pagi: $pagi) {
      ...PagedTicketsFields
    }
  }
`)

export const ticketPageInternal = graphql(`
  "One internal User Ticket page"
  query PagedTicketsInternal($community: String!, $filter: TicketFilter, $pagi: PagiInput) {
    ticketPageInternal(community: $community, filter: $filter, pagi: $pagi) {
      ...PagedTicketsFields
    }
  }
`)

export const ticket = graphql(`
  "One public User Ticket by Community-shared number"
  query Ticket($community: String!, $innerId: Int!) {
    ticket(community: $community, innerId: $innerId) {
      ...TicketFields
    }
  }
`)

export const ticketInternal = graphql(`
  "One internal User, Worker or Case Ticket"
  query TicketInternal($community: String!, $id: ID!) {
    ticketInternal(community: $community, id: $id) {
      ...TicketFields
    }
  }
`)

export const postTicketLinksInternal = graphql(`
  "Internally visible User Tickets linked to one Post"
  query PostTicketLinksInternal($community: String!, $postId: ID!) {
    postTicketLinksInternal(community: $community, postId: $postId) {
      ...TicketFields
    }
  }
`)

export const ticketSearch = graphql(`
  "Internal Ticket title prefix search"
  query TicketSearch(
    $community: String!
    $query: String!
    $type: TicketTypeEnum
    $pagi: PagiInput
  ) {
    ticketSearch(community: $community, query: $query, type: $type, pagi: $pagi) {
      ...PagedTicketsFields
    }
  }
`)

export const postTicketProgress = graphql(`
  "Batched public Ticket progress for a Post page"
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
  "Paged subscribers of a community"
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
  "Get community tag groups"
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
  "Create a User Ticket Draft from a public Post"
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
  "Link a typed source to a User Ticket; currently only POST is supported"
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
  "Unlink a TicketSource relation by its relation ID"
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
  "Create a private Worker Ticket under a User Ticket"
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
  "Create an internal Case Ticket"
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
  "Transition Ticket work status with an expected version"
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
  "Update Ticket priority or planned dates"
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
  "Append an internal or public Ticket progress update"
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
  "Create a content Draft workspace for an already published Ticket"
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
  "Save the Ticket content Draft with Draft and Lifecycle versions"
  mutation SaveTicketDraft(
    $commandId: ID!
    $community: String!
    $id: ID!
    $content: TicketContentInput!
    $revision: Int!
    $expectedLifecycleVersion: Int!
  ) {
    saveTicketDraft(
      commandId: $commandId
      community: $community
      id: $id
      content: $content
      revision: $revision
      expectedLifecycleVersion: $expectedLifecycleVersion
    ) {
      ...TicketFields
    }
  }
`)

export const publishTicket = graphql(`
  "Publish the reviewed Ticket Draft with all three expected versions"
  mutation PublishTicket(
    $commandId: ID!
    $community: String!
    $id: ID!
    $reason: String!
    $expectedPreview: String!
    $revision: Int!
    $expectedLifecycleVersion: Int!
    $expectedWorkflowVersion: Int!
  ) {
    publishTicket(
      commandId: $commandId
      community: $community
      id: $id
      reason: $reason
      expectedPreview: $expectedPreview
      revision: $revision
      expectedLifecycleVersion: $expectedLifecycleVersion
      expectedWorkflowVersion: $expectedWorkflowVersion
    ) {
      ...TicketFields
    }
  }
`)

export const moveTicketToDraft = graphql(`
  "Move a published Ticket to Draft with its lifecycle version"
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
  "Add a User Ticket to a Case"
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
  "Remove a User Ticket from a Case"
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
  "Reference a member-owned Worker as a shared Case fix"
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
  "Replace assigned Community moderators on a Ticket"
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
  "Replace internal Post tags on a Ticket"
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
  "Replace normalized internal Ticket facets"
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
