import { graphql } from '~/graphql/authoring'

export const upvotePost = graphql(`
  mutation QueryUpvotePost($article: ArticlePathInput!, $commandId: ID!) {
    upvotePost(article: $article, commandId: $commandId) {
      innerId
      ... on Post {
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        articleStats {
          interactionRevision
        }
        reactionOutcome
      }
    }
  }
`)

export const undoUpvotePost = graphql(`
  mutation QueryUndoUpvotePost($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvotePost(article: $article, commandId: $commandId) {
      innerId
      ... on Post {
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        articleStats {
          interactionRevision
        }
        reactionOutcome
      }
    }
  }
`)

export const upvoteChangelog = graphql(`
  mutation QueryUpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
    upvoteChangelog(article: $article, commandId: $commandId) {
      innerId
      ... on Changelog {
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        articleStats {
          interactionRevision
        }
        reactionOutcome
      }
    }
  }
`)

export const undoUpvoteChangelog = graphql(`
  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvoteChangelog(article: $article, commandId: $commandId) {
      innerId
      ... on Changelog {
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        articleStats {
          interactionRevision
        }
        reactionOutcome
      }
    }
  }
`)

export const upvoteDoc = graphql(`
  mutation QueryUpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
    upvoteDoc(article: $article, commandId: $commandId) {
      innerId
      ... on Doc {
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        articleStats {
          interactionRevision
        }
        reactionOutcome
      }
    }
  }
`)

export const undoUpvoteDoc = graphql(`
  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvoteDoc(article: $article, commandId: $commandId) {
      innerId
      ... on Doc {
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        articleStats {
          interactionRevision
        }
        reactionOutcome
      }
    }
  }
`)
