import { gql } from 'urql'

import { F } from '~/schemas'

const updatePost = gql`
  mutation ($article: ArticlePathInput!, $title: String, $body: String, $communityTags: [ID]) {
    updatePost(article: $article, title: $title, body: $body, communityTags: $communityTags) {
      innerId
      title
      communityTags {
        ${F.tag}
      }
    }
  }
`
const setPostCat = gql`
  mutation ($article: ArticlePathInput!, $cat: ArticleCatEnum!) {
    setPostCat(article: $article, cat: $cat) {
      innerId
      cat
    }
  }
`
const setPostStatus = gql`
  mutation ($article: ArticlePathInput!, $status: ArticleStatusEnum!) {
    setPostStatus(article: $article, status: $status) {
      innerId
      status
    }
  }
`

const pinPost = gql`
  mutation ($article: ArticlePathInput!) {
    pinPost(article: $article) {
      innerId
    }
  }
`

const undoPinPost = gql`
  mutation ($article: ArticlePathInput!) {
    undoPinPost(article: $article) {
      innerId
      isPinned
    }
  }
`

const communityTagGroups = gql`
  query ($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ${F.tag}
      }
    }
  }
`

const schema = {
  updatePost,
  setPostCat,
  setPostStatus,
  pinPost,
  undoPinPost,
  communityTagGroups,
}

export default schema
