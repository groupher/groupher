import { graphql } from '~/graphql/authoring'

export const DashboardAuthorFields = graphql(`
  fragment DashboardAuthorFields on User {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const DashboardTagFields = graphql(`
  fragment DashboardTagFields on CommunityTag {
    id
    title
    layout
    desc
    slug
    color
    marker {
      type
      provider
      name
      src
      unified
    }
    thread
    group
    groupId
    index
    community {
      slug
    }
  }
`)

export const DashboardThirdPartyAnalyticsFields = graphql(`
  fragment DashboardThirdPartyAnalyticsFields on DsbThirdPartyAnalytics {
    provider
    enabled
    measurementId
    containerId
    projectId
    domain
    siteId
  }
`)

export const DashboardHeaderLinkFields = graphql(`
  fragment DashboardHeaderLinkFields on DsbLink {
    id
    type
    title
    url
    links {
      id
      title
      url
    }
  }
`)

export const DashboardFooterOnelineLinkFields = graphql(`
  fragment DashboardFooterOnelineLinkFields on DsbLinkChild {
    id
    title
    url
  }
`)

export const DashboardTrashedArticlesPageInfo = graphql(`
  fragment DashboardTrashedArticlesPageInfo on PagedTrashedArticles {
    totalCount
    pageSize
    totalPages
    pageNumber
  }
`)
