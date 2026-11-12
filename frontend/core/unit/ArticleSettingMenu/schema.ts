import { graphql } from '~/graphql/authoring'

const saveWorkingCopy = graphql(`
  "Save one Article WorkingCopy patch at its current revision"
  mutation SaveWorkingCopyFieldsFromMenu(
    $articleId: ID!
    $workingCopyId: ID!
    $community: String!
    $commandId: ID!
    $revision: Int!
    $title: String
    $tagIds: [ID]
  ) {
    saveWorkingCopy(
      articleId: $articleId
      workingCopyId: $workingCopyId
      community: $community
      commandId: $commandId
      revision: $revision
      title: $title
      tagIds: $tagIds
    ) {
      id
      articleId
      scopeKind
      revision
      title
      tagIds
    }
  }
`)

const articleWorkingCopies = graphql(`
  "Editable WorkingCopies for one Article"
  query ArticleWorkingCopiesForMenu($articleId: ID!, $community: String!) {
    articleWorkingCopies(articleId: $articleId, community: $community) {
      id
      articleId
      scopeKind
      revision
      title
      tagIds
    }
  }
`)

const setPostCat = graphql(`
  "Set cat for a post"
  mutation SetPostCat($article: ArticlePathInput!, $cat: ArticleCatEnum!, $commandId: ID!) {
    setPostCat(article: $article, cat: $cat, commandId: $commandId) {
      innerId
      cat
    }
  }
`)

const pinPost = graphql(`
  "Pin to post"
  mutation PinPost($article: ArticlePathInput!, $commandId: ID!) {
    pinPost(article: $article, commandId: $commandId) {
      innerId
    }
  }
`)

const undoPinPost = graphql(`
  "Undo pin to post"
  mutation UndoPinPost($article: ArticlePathInput!, $commandId: ID!) {
    undoPinPost(article: $article, commandId: $commandId) {
      innerId
      isPinned
    }
  }
`)

const communityTagGroups = graphql(`
  "Get community tag groups"
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
  saveWorkingCopy,
  articleWorkingCopies,
  setPostCat,
  pinPost,
  undoPinPost,
  communityTagGroups,
}
