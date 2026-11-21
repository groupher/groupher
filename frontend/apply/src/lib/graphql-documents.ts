import { graphql } from '@groupher/frontend-core/graphql/authoring'

export const ApplyApplicationFields = graphql(`
  fragment ApplyApplicationFields on CommunityApplication {
    publicRef
    status
    version
    title
    slug
    desc
    locale
    applyCategory
    applyMessage
    submittedAt
    completedAt
    updatedAt
    decisionReasonCode
    logo {
      applicationUploadRef
      communityAssetRef
      url
    }
    community {
      publicRef
      slug
    }
  }
`)

export const ApplyAccountDocument = graphql(`
  "Get cur user"
  query ApplyAccount {
    me {
      login
    }
  }
`)

export const ApplyInitialStateDocument = graphql(`
  "Current user's Apply admission state and blocking application"
  query ApplyInitialState {
    communityApplicationState {
      canApply {
        allowed
        reasonCode
        retryAt
      }
      currentApplication {
        ...ApplyApplicationFields
      }
      latestFailedApplication {
        publicRef
        status
        title
        slug
        updatedAt
      }
    }
  }
`)

export const OwnedApplicationDocument = graphql(`
  "One Community Application owned by the current user"
  query OwnedApplication($ref: ID!) {
    communityApplication(ref: $ref) {
      ...ApplyApplicationFields
    }
  }
`)

export const ReviewQueueDocument = graphql(`
  "Reviewer-scoped Community Application queue"
  query ReviewQueue($pagi: PagiInput) {
    pagedCommunityApplications(
      filter: { statuses: [SUBMITTED, REVIEWING, APPROVED, CREATION_FAILED, SETUP_FAILED] }
      pagi: $pagi
    ) {
      entries {
        ...ApplyApplicationFields
        reviewer {
          publicRef
        }
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
  }
`)

export const ReviewApplicationDocument = graphql(`
  "Reviewer-scoped detail for any Community Application"
  query ReviewApplication($ref: ID!, $pagi: PagiInput) {
    reviewCommunityApplication(ref: $ref) {
      ...ApplyApplicationFields
      applicant {
        publicRef
      }
      reviewer {
        publicRef
      }
      expiresAt
      reviewedAt
      setupStartedAt
      decisionNote
      lastJobError {
        reasonCode
        message
        operationRef
        occurredAt
      }
      events(pagi: $pagi) {
        entries {
          fromStatus
          toStatus
          actorType
          actor {
            publicRef
          }
          reasonCode
          operationRef
          occurredAt
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
    }
  }
`)

export const SubmitApplicationDocument = graphql(`
  "Submit a new Community Application"
  mutation SubmitApplication($input: CommunityApplicationInput!, $commandId: ID!) {
    submitCommunityApplication(input: $input, commandId: $commandId) {
      publicRef
      status
      version
      title
      slug
      desc
      locale
      applyCategory
      applyMessage
      submittedAt
      updatedAt
      logo {
        applicationUploadRef
        communityAssetRef
        url
      }
    }
  }
`)

export const StartApplicationReviewDocument = graphql(`
  "Move a submitted Application into review"
  mutation StartApplicationReview($ref: ID!, $expectedVersion: Int!, $commandId: ID!) {
    startCommunityApplicationReview(
      ref: $ref
      expectedVersion: $expectedVersion
      commandId: $commandId
    ) {
      publicRef
      status
      version
      title
      slug
      desc
      locale
      applyCategory
      submittedAt
      updatedAt
      logo {
        applicationUploadRef
        communityAssetRef
        url
      }
    }
  }
`)

export const ApproveApplicationDocument = graphql(`
  "Approve a reviewed Community Application"
  mutation ApproveApplication($ref: ID!, $expectedVersion: Int!, $commandId: ID!, $note: String) {
    approveCommunityApplication(
      ref: $ref
      expectedVersion: $expectedVersion
      commandId: $commandId
      note: $note
    ) {
      publicRef
      status
      version
      title
      slug
      desc
      locale
      applyCategory
      submittedAt
      updatedAt
      logo {
        applicationUploadRef
        communityAssetRef
        url
      }
    }
  }
`)

export const RejectApplicationDocument = graphql(`
  "Reject a reviewed Community Application"
  mutation RejectApplication(
    $ref: ID!
    $expectedVersion: Int!
    $commandId: ID!
    $reasonCode: String!
    $note: String
  ) {
    rejectCommunityApplication(
      ref: $ref
      expectedVersion: $expectedVersion
      commandId: $commandId
      reasonCode: $reasonCode
      note: $note
    ) {
      publicRef
      status
      version
      title
      slug
      desc
      locale
      applyCategory
      submittedAt
      updatedAt
      logo {
        applicationUploadRef
        communityAssetRef
        url
      }
    }
  }
`)

export const RetryCommunityCreationDocument = graphql(`
  "Retry Community identity creation for a failed Application"
  mutation RetryCommunityCreation($ref: ID!, $expectedVersion: Int!, $commandId: ID!) {
    retryCommunityCreation(ref: $ref, expectedVersion: $expectedVersion, commandId: $commandId) {
      publicRef
      status
      version
      title
      slug
      desc
      locale
      applyCategory
      submittedAt
      updatedAt
      logo {
        applicationUploadRef
        communityAssetRef
        url
      }
    }
  }
`)

export const RetryCommunitySetupDocument = graphql(`
  "Retry Community setup for a failed Application"
  mutation RetryCommunitySetup($ref: ID!, $expectedVersion: Int!, $commandId: ID!) {
    retryCommunitySetup(ref: $ref, expectedVersion: $expectedVersion, commandId: $commandId) {
      publicRef
      status
      version
      title
      slug
      desc
      locale
      applyCategory
      submittedAt
      updatedAt
      logo {
        applicationUploadRef
        communityAssetRef
        url
      }
    }
  }
`)

export const CancelApplicationDocument = graphql(`
  "Cancel an owned Community Application"
  mutation CancelApplication($ref: ID!, $expectedVersion: Int!, $commandId: ID!) {
    cancelCommunityApplication(
      ref: $ref
      expectedVersion: $expectedVersion
      commandId: $commandId
    ) {
      publicRef
      status
      version
      title
      slug
      desc
      locale
      applyCategory
      submittedAt
      updatedAt
      logo {
        applicationUploadRef
        communityAssetRef
        url
      }
    }
  }
`)

export const ApplicationLogoIntentDocument = graphql(`
  "Create an Application-scoped Community Logo upload intent"
  mutation ApplicationLogoIntent($input: ApplicationLogoUploadInput!) {
    createCommunityApplicationLogoUploadIntent(input: $input) {
      uploadRef
      capability
      canonicalUrl
    }
  }
`)
