import { gql } from 'urql'

import { F } from '~/schemas'

const updatePost = gql`
  mutation ($article: ArticleRefInput!, $title: String, $body: String, $communityTags: [ID]) {
    updatePost(article: $article, title: $title, body: $body, communityTags: $communityTags) {
      id
      title
      communityTags {
        ${F.tag}
      }
    }
  }
`
const setPostCat = gql`
  mutation ($article: ArticleRefInput!, $cat: ArticleCatEnum!) {
    setPostCat(article: $article, cat: $cat) {
      id
      cat
    }
  }
`
const setPostState = gql`
  mutation ($article: ArticleRefInput!, $state: ArticleStateEnum!) {
    setPostState(article: $article, state: $state) {
      id
      state
    }
  }
`

const pinPost = gql`
  mutation ($article: ArticleRefInput!) {
    pinPost(article: $article) {
      id
    }
  }
`

const undoPinPost = gql`
  mutation ($article: ArticleRefInput!) {
    undoPinPost(article: $article) {
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
