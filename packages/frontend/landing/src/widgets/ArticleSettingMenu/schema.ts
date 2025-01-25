import { gql } from 'urql'

import { F } from '~/schemas'

const updatePost = gql`
  mutation ($id: ID!, $title: String, $body: String, $articleTags: [ID]) {
    updatePost(id: $id, title: $title, body: $body, articleTags: $articleTags) {
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

const pagedArticleTags = gql`
  query ($filter: ArticleTagsFilter) {
    pagedArticleTags(filter: $filter) {
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
  pagedArticleTags,
}

export default schema
