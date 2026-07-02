import { gql } from 'urql'

import { F } from '~/schemas'

const updatePost = gql`
  mutation ($article: ArticlePathInput!, $title: String, $body: String, $communityTags: [ID]) {
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
  mutation ($article: ArticlePathInput!, $cat: ArticleCatEnum!) {
    setPostCat(article: $article, cat: $cat) {
      id
      cat
    }
  }
`
const setPostStatus = gql`
  mutation ($article: ArticlePathInput!, $status: ArticleStatusEnum!) {
    setPostStatus(article: $article, status: $status) {
      id
      status
    }
  }
`

const pinPost = gql`
  mutation ($article: ArticlePathInput!) {
    pinPost(article: $article) {
      id
    }
  }
`

const undoPinPost = gql`
  mutation ($article: ArticlePathInput!) {
    undoPinPost(article: $article) {
      id
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
