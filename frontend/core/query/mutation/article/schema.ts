import { graphql } from '~/graphql/authoring'

export const upvotePost = graphql(`
  "Upvote to post"
  mutation UpvotePost($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation UndoUpvotePost($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation UpvoteBlog($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation UndoUpvoteBlog($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation UpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation UndoUpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation UpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation UndoUpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
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
  mutation EmotionToPost($article: ArticlePathInput!, $emotion: ArticleEmotion!, $commandId: ID!) {
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
  mutation UndoEmotionToPost(
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
  mutation EmotionToBlog($article: ArticlePathInput!, $emotion: ArticleEmotion!, $commandId: ID!) {
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
  mutation UndoEmotionToBlog(
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
  mutation EmotionToChangelog(
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
  mutation UndoEmotionToChangelog(
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
  mutation EmotionToDoc($article: ArticlePathInput!, $emotion: ArticleEmotion!, $commandId: ID!) {
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
  mutation UndoEmotionToDoc(
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
  mutation AddToCollect($article: ArticlePathInput!, $folderId: ID!, $commandId: ID!) {
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
  mutation RemoveFromCollect($article: ArticlePathInput!, $folderId: ID!, $commandId: ID!) {
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
