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
      scopeType
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
      scopeType
      revision
      title
      tagIds
    }
  }
`)

const articleHistoryEvents = graphql(`
  query ArticleHistoryEventsFromMenu($articleId: ID!, $pagi: Json, $actorId: ID) {
    pagedArticleEvents(articleId: $articleId, pagi: $pagi, actorId: $actorId)
  }
`)

const articleHistoryEvent = graphql(`
  query ArticleHistoryEventFromMenu($articleId: ID!, $eventId: ID!, $pagi: Json) {
    articleEvent(articleId: $articleId, eventId: $eventId, pagi: $pagi)
  }
`)

const articleHistoryDiff = graphql(`
  query ArticleHistoryDiffFromMenu(
    $articleId: ID!
    $before: ArticleVersionRefInput!
    $after: ArticleVersionRefInput!
  ) {
    articleDiff(articleId: $articleId, before: $before, after: $after)
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
  articleHistoryEvents,
  articleHistoryEvent,
  articleHistoryDiff,
  setPostCat,
  pinPost,
  undoPinPost,
  communityTagGroups,
}
