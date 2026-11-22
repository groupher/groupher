import { graphql } from '~/graphql/authoring'

export const communityActivityConfig = graphql(`
  "Active Community Activity actions available to the current manager"
  query CommunityActivityConfig($community: String!) {
    communityActivityConfig(community: $community) {
      resources {
        resourceType
        actions {
          action
          messageKey
          category
          highRisk
        }
      }
      sources
      actorTypes
      presets {
        key
        questionKey
        descriptionKey
        coverageNoteKey
        defaultTimeRange {
          amount
          unit
        }
      }
    }
  }
`)

export const exportCommunityActivity = graphql(`
  "Exports Activity evidence and records the export before returning the artifact"
  mutation ExportCommunityActivity(
    $community: String!
    $selection: CommunityActivitySelectionInput!
    $format: CommunityActivityExportFormat!
  ) {
    exportCommunityActivity(community: $community, selection: $selection, format: $format) {
      content
      filename
      mimeType
      totalCount
      exportedCount
      manifest
      queryContext {
        preset {
          key
          questionKey
        }
        appliedFilter
        coverage
        presetIntersectionEmpty
      }
    }
  }
`)

export const communityActivityEvent = graphql(`
  "Reads one safe Community Activity event by event reference"
  query CommunityActivityEvent($community: String!, $eventRef: ID!) {
    communityActivityEvent(community: $community, eventRef: $eventRef) {
      id
      eventRef
      operationRef
      parentEventRef
      operationIndex
      recordSequence
      messageKey
      action
      category
      highRisk
      outcome
      rejectionCode
      changedFields
      resource {
        type
        ref
        title
        innerId
      }
      actor {
        type
        id
        login
        nickname
        avatar
      }
      onBehalfOf {
        type
        id
        login
        nickname
        avatar
      }
      subject {
        type
        ref
        title
        innerId
      }
      target {
        type
        ref
        title
        innerId
      }
      source
      payload
      metadata
      occurredAt
      recordedAt
      parentEvent {
        id
        eventRef
        operationRef
        parentEventRef
        operationIndex
        recordSequence
        messageKey
        action
        category
        highRisk
        outcome
        rejectionCode
        changedFields
        resource {
          type
          ref
          title
          innerId
        }
        actor {
          type
          id
          login
          nickname
          avatar
        }
        subject {
          type
          ref
          title
          innerId
        }
        target {
          type
          ref
          title
          innerId
        }
        source
        payload
        metadata
        occurredAt
        recordedAt
      }
      childEvents {
        id
        eventRef
        operationRef
        parentEventRef
        operationIndex
        recordSequence
        messageKey
        action
        category
        highRisk
        outcome
        rejectionCode
        changedFields
        resource {
          type
          ref
          title
          innerId
        }
        actor {
          type
          id
          login
          nickname
          avatar
        }
        subject {
          type
          ref
          title
          innerId
        }
        target {
          type
          ref
          title
          innerId
        }
        source
        payload
        metadata
        occurredAt
        recordedAt
      }
    }
  }
`)

export const communityActivity = graphql(`
  "Safe Community Activity timeline across readable resource streams"
  query CommunityActivity(
    $community: String!
    $selection: CommunityActivitySelectionInput!
    $pagi: PagiInput
  ) {
    communityActivity(community: $community, selection: $selection, pagi: $pagi) {
      entries {
        id
        eventRef
        operationRef
        parentEventRef
        operationIndex
        recordSequence
        messageKey
        action
        category
        highRisk
        outcome
        rejectionCode
        changedFields
        resource {
          type
          ref
          title
          innerId
        }
        actor {
          type
          id
          login
          nickname
          avatar
        }
        onBehalfOf {
          type
          id
          login
          nickname
          avatar
        }
        subject {
          type
          ref
          title
          innerId
        }
        target {
          type
          ref
          title
          innerId
        }
        source
        payload
        metadata
        occurredAt
        recordedAt
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
      queryContext {
        preset {
          key
          questionKey
        }
        appliedFilter
        coverage
        presetIntersectionEmpty
      }
    }
  }
`)

export const communityActivityStats = graphql(`
  "UTC daily Community Activity counts for the timeline overview"
  query CommunityActivityStats($community: String!, $selection: CommunityActivitySelectionInput!) {
    communityActivityStats(community: $community, selection: $selection) {
      granularity
      timezone
      totalCount
      buckets {
        startedAt
        endedAt
        count
      }
      queryContext {
        preset {
          key
          questionKey
        }
        appliedFilter
        coverage
        presetIntersectionEmpty
      }
    }
  }
`)
