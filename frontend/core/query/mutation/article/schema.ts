import { graphql } from '~/graphql/authoring'

export const upvotePost = graphql(`
  mutation QueryUpvotePost($article: ArticlePathInput!, $commandId: ID!) {
    upvotePost(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoUpvotePost = graphql(`
  mutation QueryUndoUpvotePost($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvotePost(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const upvoteBlog = graphql(`
  mutation QueryUpvoteBlog($article: ArticlePathInput!, $commandId: ID!) {
    upvoteBlog(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoUpvoteBlog = graphql(`
  mutation QueryUndoUpvoteBlog($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvoteBlog(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const upvoteChangelog = graphql(`
  mutation QueryUpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
    upvoteChangelog(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoUpvoteChangelog = graphql(`
  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvoteChangelog(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const upvoteDoc = graphql(`
  mutation QueryUpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
    upvoteDoc(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoUpvoteDoc = graphql(`
  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvoteDoc(article: $article, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const emotionToPost = graphql(`
  mutation QueryEmotionToPost(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    emotionToPost(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoEmotionToPost = graphql(`
  mutation QueryUndoEmotionToPost(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    undoEmotionToPost(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const emotionToBlog = graphql(`
  mutation QueryEmotionToBlog(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    emotionToBlog(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoEmotionToBlog = graphql(`
  mutation QueryUndoEmotionToBlog(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    undoEmotionToBlog(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const emotionToChangelog = graphql(`
  mutation QueryEmotionToChangelog(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    emotionToChangelog(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoEmotionToChangelog = graphql(`
  mutation QueryUndoEmotionToChangelog(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    undoEmotionToChangelog(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const emotionToDoc = graphql(`
  mutation QueryEmotionToDoc(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    emotionToDoc(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const undoEmotionToDoc = graphql(`
  mutation QueryUndoEmotionToDoc(
    $article: ArticlePathInput!
    $emotion: ArticleEmotion!
    $commandId: ID!
  ) {
    undoEmotionToDoc(article: $article, emotion: $emotion, commandId: $commandId) {
      commandId
      reactionOutcome
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const addToCollect = graphql(`
  mutation QueryAddToCollect($article: ArticlePathInput!, $folderId: ID!, $commandId: ID!) {
    addToCollect(article: $article, folderId: $folderId, commandId: $commandId) {
      commandId
      folder {
        id
        title
        desc
        index
        totalCount
        private
        lastUpdated
        meta {
          hasPost
          postCount
          hasBlog
          blogCount
          hasChangelog
          changelogCount
          hasDoc
          docCount
        }
        insertedAt
        updatedAt
      }
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)

export const removeFromCollect = graphql(`
  mutation QueryRemoveFromCollect($article: ArticlePathInput!, $folderId: ID!, $commandId: ID!) {
    removeFromCollect(article: $article, folderId: $folderId, commandId: $commandId) {
      commandId
      folder {
        id
        title
        desc
        index
        totalCount
        private
        lastUpdated
        meta {
          hasPost
          postCount
          hasBlog
          blogCount
          hasChangelog
          changelogCount
          hasDoc
          docCount
        }
        insertedAt
        updatedAt
      }
      articleStats {
        ...ArticleStatsFields
      }
      interactionState {
        ...ArticleInteractionStateFields
      }
    }
  }
`)
