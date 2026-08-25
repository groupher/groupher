import { graphql } from '~/graphql/authoring'

export const communityActivityConfig = graphql(`
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
      denialCode
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
        denialCode
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
        denialCode
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
  query CommunityActivity(
    $community: String!
    $selection: CommunityActivitySelectionInput!
    $page: Int = 1
  ) {
    communityActivity(community: $community, selection: $selection, page: $page) {
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
        denialCode
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
      totalCount
      totalPages
      pageNumber
      pageSize
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
