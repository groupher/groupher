import { gql } from 'urql'
import { F } from '~/schemas'

const pagedCommunities = gql`
  query($filter: CommunitiesFilter!, $userHasLogin: Boolean!) {
    pagedCommunities(filter: $filter) {
      entries {
        ${F.community}
        contributesDigest
        subscribersCount
        viewerHasSubscribed @include(if: $userHasLogin)
      }
      ${F.pagi}
    }
  }
`

const searchCommunities = gql`
  query($title: String!, $userHasLogin: Boolean!) {
    searchCommunities(title: $title) {
      entries {
        ${F.community}
        contributesDigest
        subscribersCount
        viewerHasSubscribed @include(if: $userHasLogin)
      }
      ${F.pagi}
    }
  }
`

const subscribeCommunity = gql`
  mutation($communityId: ID!) {
    subscribeCommunity(communityId: $communityId) {
      ${F.community}
      contributesDigest
      threads {
        title
        slug
      }
    }
  }
`
const unsubscribeCommunity = gql`
  mutation ($communityId: ID!) {
    unsubscribeCommunity(communityId: $communityId) {
      id
    }
  }
`
const pagedCategories = gql`
  query ($filter: PagiFilter!) {
    pagedCategories(filter: $filter) {
      entries {
        id
        title
        slug
        index
      }
      totalCount
      totalPages
      pageSize
      pageNumber
    }
  }
`

const hasPendingCommunityApply = gql`
  query {
    hasPendingCommunityApply {
      exist
    }
  }
`

const isCommunityExist = gql`
  query ($slug: String!) {
    isCommunityExist(slug: $slug) {
      exist
    }
  }
`

const applyCommunity = gql`
  mutation (
    $title: String!
    $desc: String!
    $logo: String!
    $slug: String!
    $applyMsg: String
    $applyCategory: String
  ) {
    applyCommunity(
      title: $title
      desc: $desc
      logo: $logo
      slug: $slug
      applyMsg: $applyMsg
      applyCategory: $applyCategory
    ) {
      pending
      logo
      desc
      title
      slug
    }
  }
`

const schema = {
  pagedCommunities,
  searchCommunities,
  subscribeCommunity,
  unsubscribeCommunity,
  pagedCategories,
  hasPendingCommunityApply,
  isCommunityExist,
  applyCommunity,
}

export default schema
