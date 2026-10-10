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
  query ApplyAccount {
    me {
      login
    }
  }
`)

export const ApplyInitialStateDocument = graphql(`
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
  query OwnedApplication($ref: ID!) {
    communityApplication(ref: $ref) {
      ...ApplyApplicationFields
    }
  }
`)

export const ReviewQueueDocument = graphql(`
  query ReviewQueue($after: String) {
    pagedCommunityApplications(
      filter: { statuses: [SUBMITTED, REVIEWING, APPROVED, CREATION_FAILED, SETUP_FAILED] }
      first: 100
      after: $after
    ) {
      edges {
        node {
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
          reviewer {
            publicRef
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const ReviewApplicationDocument = graphql(`
  query ReviewApplication($ref: ID!) {
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
      events(first: 100) {
        edges {
          cursor
          node {
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
        }
      }
    }
  }
`)

export const SubmitApplicationDocument = graphql(`
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
  mutation ApplicationLogoIntent($input: ApplicationLogoUploadInput!) {
    createCommunityApplicationLogoUploadIntent(input: $input) {
      uploadRef
      capability
      canonicalUrl
    }
  }
`)
