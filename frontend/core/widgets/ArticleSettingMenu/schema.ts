import { gql } from 'urql'

import { F } from '~/schemas'

const updatePost = gql`
  mutation ($id: ID!, $title: String, $body: String, $communityTags: [ID]) {
    updatePost(id: $id, title: $title, body: $body, communityTags: $communityTags) {
      id
      title
      articleTags {
        ${F.tag}
      }
    }
  }
`
const setPostCat = gql`
  mutation ($id: ID!, $cat: ArticleCatEnum!) {
    setPostCat(id: $id, cat: $cat) {
      id
      cat
    }
  }
`
const setPostState = gql`
  mutation ($id: ID!, $state: ArticleStateEnum!) {
    setPostState(id: $id, state: $state) {
      id
      state
    }
  }
`

const pinPost = gql`
  mutation ($id: ID!, $communityId: ID!) {
    pinPost(id: $id, communityId: $communityId) {
      id
    }
  }
`

const undoPinPost = gql`
  mutation ($id: ID!, $communityId: ID!) {
    undoPinPost(id: $id, communityId: $communityId) {
      id
      isPinned
    }
  }
`

const pagedCommunityTags = gql`
  query ($filter: CommunityTagsFilter) {
    pagedCommunityTags(filter: $filter) {
      entries {
        ${F.tag}
      }
    }
  }
`

const schema = {
  updatePost,
  setPostCat,
  setPostState,
  pinPost,
  undoPinPost,
  pagedCommunityTags,
}

export default schema
