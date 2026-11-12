import { graphql } from '~/graphql/authoring'

export const upvotePost = graphql(`
  "Upvote to post"
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
  "Undo upvote to post"
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
  "Upvote to blog"
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
  "Undo upvote to blog"
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
  "Upvote to changelog"
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
  "Undo upvote to changelog"
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
  "Emotion to post"
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
  "Undo emotion to post"
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
  "Emotion to blog"
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
  "Undo emotion to blog"
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
  "Emotion to changelog"
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
  "Undo emotion to changelog"
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
  "Add article into a collect folder"
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
  "Remove article from a collect folder"
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
