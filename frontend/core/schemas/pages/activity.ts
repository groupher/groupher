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
    }
  }
`)

export const communityActivityExport = graphql(`
  query CommunityActivityExport(
    $community: String!
    $filter: CommunityActivityFilter
    $format: CommunityActivityExportFormat!
  ) {
    communityActivityExport(community: $community, filter: $filter, format: $format) {
      content
      filename
      mimeType
      totalCount
      exportedCount
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
      messageKey
      action
      category
      highRisk
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
      parentEvent {
        id
        eventRef
        operationRef
        parentEventRef
        messageKey
        action
        category
        highRisk
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
      }
      childEvents {
        id
        eventRef
        operationRef
        parentEventRef
        messageKey
        action
        category
        highRisk
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
      }
    }
  }
`)

export const communityActivity = graphql(`
  query CommunityActivity($community: String!, $filter: CommunityActivityFilter) {
    communityActivity(community: $community, filter: $filter) {
      entries {
        id
        eventRef
        operationRef
        parentEventRef
        messageKey
        action
        category
        highRisk
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
      }
      totalCount
      totalPages
      pageNumber
      pageSize
    }
  }
`)

export const communityActivityStats = graphql(`
  query CommunityActivityStats($community: String!, $filter: CommunityActivityStatsFilter!) {
    communityActivityStats(community: $community, filter: $filter) {
      granularity
      timezone
      totalCount
      buckets {
        startedAt
        endedAt
        count
      }
    }
  }
`)
