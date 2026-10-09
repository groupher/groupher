import { graphql } from '~/graphql/authoring'

const updatePost = graphql(`
  mutation UpdatePostFromMenu(
    $article: ArticlePathInput!
    $commandId: ID!
    $expectedVersion: Int!
    $title: String
    $communityTags: [ID]
  ) {
    updatePost(
      article: $article
      commandId: $commandId
      expectedVersion: $expectedVersion
      title: $title
      communityTags: $communityTags
    ) {
      innerId
      title
      communityTags {
        ...ArticleMenuTagFields
      }
    }
  }
`)

const setPostCat = graphql(`
  mutation SetPostCat($article: ArticlePathInput!, $cat: ArticleCatEnum!, $commandId: ID!) {
    setPostCat(article: $article, cat: $cat, commandId: $commandId) {
      innerId
      cat
    }
  }
`)

const setPostStatus = graphql(`
  mutation SetPostStatus(
    $article: ArticlePathInput!
    $status: ArticleStatusEnum!
    $commandId: ID!
  ) {
    setPostStatus(article: $article, status: $status, commandId: $commandId) {
      innerId
      status
    }
  }
`)

const pinPost = graphql(`
  mutation PinPost($article: ArticlePathInput!, $commandId: ID!) {
    pinPost(article: $article, commandId: $commandId) {
      innerId
    }
  }
`)

const undoPinPost = graphql(`
  mutation UndoPinPost($article: ArticlePathInput!, $commandId: ID!) {
    undoPinPost(article: $article, commandId: $commandId) {
      innerId
      isPinned
    }
  }
`)

const communityTagGroups = graphql(`
  query CommunityTagGroupsForMenu($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ...ArticleMenuTagFields
      }
    }
  }
`)

export default {
  updatePost,
  setPostCat,
  setPostStatus,
  pinPost,
  undoPinPost,
  communityTagGroups,
}
